const nodemailer = require('nodemailer');
const { consultar } = require('../config/db');

const MAX_INTENTOS = 5;

function crearTransporte() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
  });
}

/**
 * Intenta enviar una notificación guardada. Si falla (sin internet, SMTP mal configurado),
 * la notificación queda 'Pendiente' para reenviarse después; tras MAX_INTENTOS queda 'Fallida'.
 * Nunca lanza error: el registro que originó el correo (la solicitud) ya está guardado.
 */
async function enviarNotificacion(id) {
  const [n] = await consultar('SELECT * FROM notificaciones WHERE id = @id', { id });
  if (!n || n.estado === 'Enviada') return n ? n.estado : null;

  const transporte = crearTransporte();
  try {
    if (!transporte) throw new Error('El servidor de correo (SMTP) no está configurado en .env');
    await transporte.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: n.email,
      subject: n.asunto,
      text: n.mensaje,
    });
    await consultar(
      `UPDATE notificaciones SET estado='Enviada', intentos=intentos+1, enviada_en=SYSDATETIME(), ultimo_error=NULL WHERE id=@id`,
      { id }
    );
    return 'Enviada';
  } catch (err) {
    const estado = n.intentos + 1 >= MAX_INTENTOS ? 'Fallida' : 'Pendiente';
    await consultar(
      'UPDATE notificaciones SET estado=@estado, intentos=intentos+1, ultimo_error=@error WHERE id=@id',
      { id, estado, error: String(err.message).slice(0, 300) }
    ).catch(() => {});
    return estado;
  }
}

/** Reintenta todas las notificaciones pendientes. Devuelve cuántas se enviaron. */
async function reenviarPendientes() {
  const pendientes = await consultar("SELECT id FROM notificaciones WHERE estado = 'Pendiente'");
  let enviadas = 0;
  for (const { id } of pendientes) {
    if ((await enviarNotificacion(id)) === 'Enviada') enviadas += 1;
  }
  return { revisadas: pendientes.length, enviadas };
}

module.exports = { enviarNotificacion, reenviarPendientes, MAX_INTENTOS };
