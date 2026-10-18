const { consultar } = require('../config/db');

/** Registra una acción en la tabla auditoria. Nunca interrumpe la petición si falla. */
async function registrarAuditoria({ usuarioId = null, accion, tabla = null, registroId = null, detalle = null, ip = null }) {
  try {
    await consultar(
      `INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, detalle, ip)
       VALUES (@usuarioId, @accion, @tabla, @registroId, @detalle, @ip)`,
      { usuarioId, accion, tabla, registroId, detalle: detalle ? String(detalle).slice(0, 500) : null, ip }
    );
  } catch (err) {
    console.error('No se pudo registrar la auditoría:', err.message);
  }
}

module.exports = { registrarAuditoria };
