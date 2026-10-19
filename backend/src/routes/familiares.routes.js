const express = require('express');
const { consultar, transaccion } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');
const { paramId, manejar, fallo } = require('../utils/rutas');
const v = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');

// Montado en /api : rutas /familiares y /residentes/:residenteId/familiares
const router = express.Router();
paramId(router, 'familiarId');
paramId(router, 'residenteId');

function validarFamiliar(b) {
  return v.juntar(
    v.texto(b.nombres, 'Los nombres', { obligatorio: true, max: 80 }),
    v.texto(b.apellidos, 'Los apellidos', { obligatorio: true, max: 80 }),
    v.vacio(b.dpi) ? null : (/^\d{13}$/.test(String(b.dpi)) ? null : 'El DPI debe tener exactamente 13 dígitos.'),
    v.telefono(b.telefono),
    v.email(b.email),
    v.texto(b.direccion, 'La dirección', { max: 200 }),
  );
}
const paramsFamiliar = (b) => ({
  nombres: v.limpio(b.nombres), apellidos: v.limpio(b.apellidos), dpi: v.limpio(b.dpi),
  telefono: v.limpio(b.telefono), email: v.limpio(b.email) && b.email.trim().toLowerCase(), direccion: v.limpio(b.direccion),
});

// GET /api/familiares?buscar=
router.get('/familiares', verificarToken, permitirRoles(...PERMISOS.verFamiliares), manejar(async (req, res) => {
  const buscar = typeof req.query.buscar === 'string' && req.query.buscar.trim() ? req.query.buscar.trim().slice(0, 80) : null;
  const filas = await consultar(
    `SELECT TOP 200 f.id, f.nombres, f.apellidos, f.dpi, f.telefono, f.email, f.direccion,
            (SELECT COUNT(*) FROM residente_familiar rf WHERE rf.familiar_id = f.id) AS internos
     FROM familiares f
     WHERE @buscar IS NULL OR f.nombres LIKE @patron OR f.apellidos LIKE @patron OR f.dpi LIKE @patron OR f.telefono LIKE @patron
     ORDER BY f.apellidos, f.nombres`,
    { buscar, patron: buscar ? `%${buscar}%` : null }
  );
  res.json(filas);
}));

// POST /api/familiares
router.post('/familiares', verificarToken, permitirRoles(...PERMISOS.editarFamiliares), manejar(async (req, res) => {
  const b = req.body || {};
  if (v.responderErrores(res, validarFamiliar(b))) return;
  const [f] = await consultar(
    `INSERT INTO familiares (nombres, apellidos, dpi, telefono, email, direccion) OUTPUT INSERTED.id
     VALUES (@nombres, @apellidos, @dpi, @telefono, @email, @direccion)`,
    paramsFamiliar(b)
  );
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'familiares', registroId: f.id, ip: req.ip });
  res.status(201).json({ id: f.id });
}));

// PUT /api/familiares/:familiarId
router.put('/familiares/:familiarId', verificarToken, permitirRoles(...PERMISOS.editarFamiliares), manejar(async (req, res) => {
  const b = req.body || {};
  if (v.responderErrores(res, validarFamiliar(b))) return;
  const filas = await consultar(
    `UPDATE familiares SET nombres=@nombres, apellidos=@apellidos, dpi=@dpi, telefono=@telefono, email=@email, direccion=@direccion
     OUTPUT INSERTED.id WHERE id=@id`,
    { ...paramsFamiliar(b), id: req.ids.familiarId }
  );
  if (!filas.length) return res.status(404).json({ mensaje: 'El familiar no existe.' });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'EDITAR', tabla: 'familiares', registroId: req.ids.familiarId, ip: req.ip });
  return res.json({ id: req.ids.familiarId });
}));

// GET /api/residentes/:residenteId/familiares
router.get('/residentes/:residenteId/familiares', verificarToken, permitirRoles(...PERMISOS.verResidentes), manejar(async (req, res) => {
  const filas = await consultar(
    `SELECT f.id, f.nombres, f.apellidos, f.telefono, f.email, rf.parentesco, rf.es_responsable
     FROM residente_familiar rf JOIN familiares f ON f.id = rf.familiar_id
     WHERE rf.residente_id = @id ORDER BY rf.es_responsable DESC, f.apellidos`,
    { id: req.ids.residenteId }
  );
  res.json(filas);
}));

// POST /api/residentes/:residenteId/familiares  { familiar_id, parentesco, es_responsable }
router.post('/residentes/:residenteId/familiares', verificarToken, permitirRoles(...PERMISOS.editarFamiliares), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.familiar_id, 'El familiar'),
    v.texto(b.parentesco, 'El parentesco', { obligatorio: true, max: 30 }),
    typeof b.es_responsable === 'boolean' || b.es_responsable === undefined ? null : 'Indique si es responsable (true o false).',
  );
  if (v.responderErrores(res, errores)) return;
  const residenteId = req.ids.residenteId;
  const familiarId = Number(b.familiar_id);
  const responsable = b.es_responsable === true;

  await transaccion(async (q) => {
    const existe = await q(
      `SELECT (SELECT COUNT(*) FROM residentes WHERE id=@r) AS r, (SELECT COUNT(*) FROM familiares WHERE id=@f) AS f`,
      { r: residenteId, f: familiarId }
    );
    if (!existe[0].r || !existe[0].f) throw fallo(404, 'El interno o el familiar no existe.');
    // Solo puede haber un responsable de pagos: si este lo será, se quita al anterior
    if (responsable) await q('UPDATE residente_familiar SET es_responsable = 0 WHERE residente_id = @r', { r: residenteId });
    await q(
      `MERGE residente_familiar AS t
       USING (SELECT @r AS residente_id, @f AS familiar_id) AS s
       ON t.residente_id = s.residente_id AND t.familiar_id = s.familiar_id
       WHEN MATCHED THEN UPDATE SET parentesco = @parentesco, es_responsable = @resp
       WHEN NOT MATCHED THEN INSERT (residente_id, familiar_id, parentesco, es_responsable) VALUES (@r, @f, @parentesco, @resp);`,
      { r: residenteId, f: familiarId, parentesco: v.limpio(b.parentesco), resp: responsable }
    );
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'VINCULAR', tabla: 'residente_familiar', registroId: residenteId, detalle: `familiar ${familiarId}`, ip: req.ip });
  res.status(201).json({ residente_id: residenteId, familiar_id: familiarId, es_responsable: responsable });
}));

// DELETE /api/residentes/:residenteId/familiares/:familiarId
router.delete('/residentes/:residenteId/familiares/:familiarId', verificarToken, permitirRoles(...PERMISOS.editarFamiliares), manejar(async (req, res) => {
  const filas = await consultar(
    'DELETE FROM residente_familiar OUTPUT DELETED.familiar_id WHERE residente_id=@r AND familiar_id=@f',
    { r: req.ids.residenteId, f: req.ids.familiarId }
  );
  if (!filas.length) return res.status(404).json({ mensaje: 'Ese familiar no está vinculado al interno.' });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'DESVINCULAR', tabla: 'residente_familiar', registroId: req.ids.residenteId, ip: req.ip });
  return res.json({ ok: true });
}));

module.exports = router;
