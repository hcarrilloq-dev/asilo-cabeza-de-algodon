const express = require('express');
const { consultar, transaccion } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS, ROLES } = require('../config/roles');
const { paramId, manejar, fallo } = require('../utils/rutas');
const v = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');
const { idVinculado, descuentos } = require('../utils/personal');
const { enviarNotificacion } = require('../utils/correo');

const router = express.Router();
router.use(verificarToken);
paramId(router, 'solicitudId');

const ESTADOS = ['Pendiente', 'Asignada', 'Atendida', 'Cancelada'];

/** Guarda el correo para el familiar responsable (si tiene correo). Devuelve el id o null. */
async function encolarCorreo(q, { residenteId, solicitudId, asunto, mensaje }) {
  const [fam] = await q(
    `SELECT f.id, f.email FROM residente_familiar rf JOIN familiares f ON f.id = rf.familiar_id
     WHERE rf.residente_id = @r AND rf.es_responsable = 1 AND f.email IS NOT NULL`,
    { r: residenteId }
  );
  if (!fam) return null;
  const [n] = await q(
    `INSERT INTO notificaciones (familiar_id, residente_id, solicitud_id, email, asunto, mensaje)
     OUTPUT INSERTED.id VALUES (@f, @r, @s, @email, @asunto, @mensaje)`,
    { f: fam.id, r: residenteId, s: solicitudId, email: fam.email, asunto, mensaje }
  );
  return n.id;
}

// GET /api/solicitudes?estado=Pendiente
// La Fundación solo recibe los datos necesarios para asignar la cita (sin ficha clínica).
router.get('/', permitirRoles(...PERMISOS.verSolicitudes), manejar(async (req, res) => {
  const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
  let filtroEnfermero = null;
  if (req.usuario.rol === ROLES.ENFERMERIA) {
    filtroEnfermero = await idVinculado(consultar, 'enfermeros', req.usuario.id);
    if (!filtroEnfermero) return res.json([]);
  }
  const filas = await consultar(
    `SELECT TOP 300 s.id, s.estado, s.prioridad, s.motivo, s.fecha_solicitud, s.especialidad_id,
            e.nombre AS especialidad, r.id AS residente_id, r.codigo, r.nombres + N' ' + r.apellidos AS residente,
            DATEDIFF(YEAR, r.fecha_nacimiento, GETDATE()) AS edad,
            mg.nombres + N' ' + mg.apellidos AS medico_general,
            en.nombres + N' ' + en.apellidos AS enfermero,
            c.id AS cita_id, c.fecha_hora, c.lugar, me.nombres + N' ' + me.apellidos AS medico_asignado
     FROM solicitudes_medicas s
     JOIN residentes r ON r.id = s.residente_id
     JOIN especialidades e ON e.id = s.especialidad_id
     JOIN medicos mg ON mg.id = s.medico_general_id
     JOIN enfermeros en ON en.id = s.enfermero_id
     LEFT JOIN citas_medicas c ON c.solicitud_id = s.id
     LEFT JOIN medicos me ON me.id = c.medico_id
     WHERE (@estado IS NULL OR s.estado = @estado) AND (@enf IS NULL OR s.enfermero_id = @enf)
     ORDER BY CASE s.prioridad WHEN 'Urgente' THEN 0 ELSE 1 END, s.fecha_solicitud DESC`,
    { estado, enf: filtroEnfermero }
  );
  return res.json(filas);
}));

// POST /api/solicitudes  (Médico general)
router.post('/', permitirRoles(...PERMISOS.crearSolicitud), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.residente_id, 'El interno'),
    v.id(b.especialidad_id, 'La especialidad'),
    v.id(b.enfermero_id, 'El enfermero(a) acompañante'),
    v.texto(b.motivo, 'El motivo', { obligatorio: true, max: 500 }),
    b.prioridad === undefined ? null : v.opcion(b.prioridad, 'La prioridad', ['Normal', 'Urgente']),
  );
  if (v.responderErrores(res, errores)) return;

  const resultado = await transaccion(async (q) => {
    const medicoId = await idVinculado(q, 'medicos', req.usuario.id);
    if (!medicoId) throw fallo(403, 'Su usuario no está vinculado a un médico general.');
    const [r] = await q("SELECT id, nombres, apellidos, estado FROM residentes WHERE id = @id", { id: Number(b.residente_id) });
    if (!r) throw fallo(404, 'El interno no existe.');
    if (r.estado !== 'Activo') throw fallo(400, 'Solo se pueden crear solicitudes para internos activos.');
    const [esp] = await q('SELECT nombre FROM especialidades WHERE id = @id', { id: Number(b.especialidad_id) });
    if (!esp) throw fallo(400, 'La especialidad no existe.');
    const [enf] = await q('SELECT id FROM enfermeros WHERE id = @id AND activo = 1', { id: Number(b.enfermero_id) });
    if (!enf) throw fallo(400, 'El enfermero(a) no existe o no está activo.');
    const [medico] = await q('SELECT nombres + N\' \' + apellidos AS nombre FROM medicos WHERE id = @id', { id: medicoId });

    const [s] = await q(
      `INSERT INTO solicitudes_medicas (residente_id, medico_general_id, especialidad_id, enfermero_id, motivo, prioridad, creado_por)
       OUTPUT INSERTED.id VALUES (@r, @m, @e, @enf, @motivo, @prioridad, @u)`,
      { r: r.id, m: medicoId, e: Number(b.especialidad_id), enf: enf.id, motivo: v.limpio(b.motivo),
        prioridad: b.prioridad || 'Normal', u: req.usuario.id }
    );
    const notificacionId = await encolarCorreo(q, {
      residenteId: r.id,
      solicitudId: s.id,
      asunto: `SIGEVAN: ${r.nombres} ${r.apellidos} fue referido(a) a ${esp.nombre}`,
      mensaje: `Estimado familiar:\n\nLe informamos que ${r.nombres} ${r.apellidos} fue evaluado(a) por el médico general `
        + `del asilo, Dr(a). ${medico.nombre}, y fue referido(a) a la especialidad de ${esp.nombre} con los médicos de la fundación.\n\n`
        + `Motivo: ${v.limpio(b.motivo)}\nPrioridad: ${b.prioridad || 'Normal'}\n\n`
        + 'Le avisaremos cuando la fundación asigne el médico y el horario de la cita.\n\nAsilo de Ancianos Cabeza de Algodón',
    });
    return { id: s.id, notificacionId };
  });

  // El correo se intenta después de guardar: si falla, la solicitud ya quedó registrada
  let correo = 'Sin correo (el interno no tiene familiar responsable con correo)';
  if (resultado.notificacionId) correo = await enviarNotificacion(resultado.notificacionId);
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'solicitudes_medicas', registroId: resultado.id, ip: req.ip });
  res.status(201).json({ id: resultado.id, correo });
}));

// POST /api/solicitudes/:solicitudId/asignar  (Fundación) { medico_id, fecha_hora, lugar, precio? }
router.post('/:solicitudId/asignar', permitirRoles(...PERMISOS.asignarCita), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.medico_id, 'El médico'),
    v.fechaHora(b.fecha_hora, 'La fecha y hora'),
    v.texto(b.lugar, 'El lugar', { max: 150 }),
    v.vacio(b.precio) ? null : v.monto(b.precio, 'El precio de la consulta', { permitirCero: true }),
  );
  if (!errores.length && new Date(b.fecha_hora) <= new Date()) errores.push('La cita debe programarse en una fecha y hora futura.');
  if (v.responderErrores(res, errores)) return;

  const id = req.ids.solicitudId;
  const resultado = await transaccion(async (q) => {
    const [s] = await q(
      `SELECT s.id, s.estado, s.especialidad_id, s.residente_id, r.nombres + N' ' + r.apellidos AS residente, e.nombre AS especialidad
       FROM solicitudes_medicas s WITH (UPDLOCK) JOIN residentes r ON r.id = s.residente_id
       JOIN especialidades e ON e.id = s.especialidad_id WHERE s.id = @id`, { id }
    );
    if (!s) throw fallo(404, 'La solicitud no existe.');
    if (s.estado !== 'Pendiente') throw fallo(409, `La solicitud ya está ${s.estado.toLowerCase()}.`);
    const [m] = await q(
      "SELECT id, nombres + N' ' + apellidos AS nombre, especialidad_id FROM medicos WHERE id = @id AND tipo = 'Especialista' AND activo = 1",
      { id: Number(b.medico_id) }
    );
    if (!m) throw fallo(400, 'El médico no existe o no es especialista de la fundación.');
    if (m.especialidad_id !== s.especialidad_id) throw fallo(400, `El médico debe ser de la especialidad ${s.especialidad}.`);
    const d = await descuentos(q);
    const precio = v.vacio(b.precio) ? d.precioConsulta : Number(b.precio);
    const [c] = await q(
      `INSERT INTO citas_medicas (solicitud_id, medico_id, fecha_hora, lugar, precio, descuento_pct, asignado_por)
       OUTPUT INSERTED.id VALUES (@s, @m, @fecha, @lugar, @precio, @desc, @u)`,
      { s: id, m: m.id, fecha: b.fecha_hora.replace('T', ' '), lugar: v.limpio(b.lugar), precio, desc: d.consulta, u: req.usuario.id }
    );
    await q("UPDATE solicitudes_medicas SET estado = 'Asignada' WHERE id = @id", { id });
    const fechaTexto = b.fecha_hora.replace('T', ' a las ');
    const notificacionId = await encolarCorreo(q, {
      residenteId: s.residente_id,
      solicitudId: id,
      asunto: `SIGEVAN: cita de ${s.residente} con ${s.especialidad}`,
      mensaje: `Estimado familiar:\n\nLa fundación asignó la cita de ${s.residente} con el Dr(a). ${m.nombre} `
        + `(${s.especialidad}) para el ${fechaTexto}${b.lugar ? ` en ${v.limpio(b.lugar)}` : ''}.\n`
        + 'Un enfermero(a) del asilo lo(a) acompañará.\n\nAsilo de Ancianos Cabeza de Algodón',
    });
    return { citaId: c.id, notificacionId };
  });

  let correo = null;
  if (resultado.notificacionId) correo = await enviarNotificacion(resultado.notificacionId);
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'ASIGNAR', tabla: 'citas_medicas', registroId: resultado.citaId, ip: req.ip });
  res.status(201).json({ cita_id: resultado.citaId, correo });
}));

// PATCH /api/solicitudes/:solicitudId/cancelar  (Médico general o Administrador; solo si está pendiente)
router.patch('/:solicitudId/cancelar', permitirRoles(ROLES.MEDICO_GENERAL, ROLES.ADMIN), manejar(async (req, res) => {
  const filas = await consultar(
    "UPDATE solicitudes_medicas SET estado = 'Cancelada' OUTPUT INSERTED.id WHERE id = @id AND estado = 'Pendiente'",
    { id: req.ids.solicitudId }
  );
  if (!filas.length) return res.status(409).json({ mensaje: 'Solo se pueden cancelar solicitudes pendientes.' });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CANCELAR', tabla: 'solicitudes_medicas', registroId: req.ids.solicitudId, ip: req.ip });
  return res.json({ id: req.ids.solicitudId, estado: 'Cancelada' });
}));

module.exports = router;
