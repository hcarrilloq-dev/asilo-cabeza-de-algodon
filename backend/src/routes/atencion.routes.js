/**
 * Citas, visitas médicas, laboratorio, farmacia y enfermería.
 * Montado en /api.
 */
const express = require('express');
const { consultar, transaccion } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS, ROLES } = require('../config/roles');
const { paramId, manejar, fallo } = require('../utils/rutas');
const v = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');
const { idVinculado, crearCargo, descuentos } = require('../utils/personal');

const router = express.Router();
paramId(router, 'citaId');
paramId(router, 'visitaId');
paramId(router, 'examenId');
paramId(router, 'vmId');
paramId(router, 'residenteId');

const CLINICOS = [ROLES.ADMIN, ROLES.MEDICO_GENERAL, ROLES.ESPECIALISTA, ROLES.ENFERMERIA];

/** Comprueba que el especialista con sesión tenga relación con el interno (alguna cita con él). */
async function especialistaAtiende(q, usuarioId, residenteId) {
  const filas = await q(
    `SELECT TOP 1 1 AS ok FROM citas_medicas c JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN medicos m ON m.id = c.medico_id WHERE m.usuario_id = @u AND s.residente_id = @r`,
    { u: usuarioId, r: residenteId }
  );
  return filas.length > 0;
}

/** Visita con su cita, médico y estado; lanza 404 si no existe. */
async function leerVisita(q, id, bloquear = false) {
  const [vis] = await q(
    `SELECT v.id, v.cita_id, v.estado, v.motivo, v.diagnostico, v.observaciones, v.fecha_visita, v.cerrada_en,
            c.medico_id, c.solicitud_id, m.usuario_id AS medico_usuario_id, m.nombres + N' ' + m.apellidos AS medico,
            e.nombre AS especialidad, s.residente_id, r.codigo, r.nombres + N' ' + r.apellidos AS residente
     FROM visitas_medicas v ${bloquear ? 'WITH (UPDLOCK)' : ''}
     JOIN citas_medicas c ON c.id = v.cita_id
     JOIN medicos m ON m.id = c.medico_id
     JOIN especialidades e ON e.id = m.especialidad_id
     JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN residentes r ON r.id = s.residente_id
     WHERE v.id = @id`, { id }
  );
  if (!vis) throw fallo(404, 'La visita no existe.');
  return vis;
}

/** Solo el especialista asignado puede modificar la visita, y solo mientras está abierta. */
function exigirDuenoAbierta(vis, usuario) {
  if (vis.medico_usuario_id !== usuario.id) throw fallo(403, 'Solo el médico que atiende la cita puede modificar esta visita.');
  if (vis.estado !== 'Abierta') throw fallo(409, 'La visita ya está cerrada y no se puede modificar.');
}

/* =========================== CITAS =========================== */

// GET /api/citas?estado=Programada
router.get('/citas', verificarToken, permitirRoles(...PERMISOS.verCitas), manejar(async (req, res) => {
  const estado = ['Programada', 'Realizada', 'Cancelada', 'No asistio'].includes(req.query.estado) ? req.query.estado : null;
  let medico = null; let enfermero = null;
  if (req.usuario.rol === ROLES.ESPECIALISTA) {
    medico = await idVinculado(consultar, 'medicos', req.usuario.id);
    if (!medico) return res.json([]);
  }
  if (req.usuario.rol === ROLES.ENFERMERIA) {
    enfermero = await idVinculado(consultar, 'enfermeros', req.usuario.id);
    if (!enfermero) return res.json([]);
  }
  const filas = await consultar(
    `SELECT TOP 300 c.id, c.fecha_hora, c.lugar, c.estado, s.motivo, s.prioridad, e.nombre AS especialidad,
            m.nombres + N' ' + m.apellidos AS medico, en.nombres + N' ' + en.apellidos AS enfermero,
            r.id AS residente_id, r.codigo, r.nombres + N' ' + r.apellidos AS residente,
            v.id AS visita_id, v.estado AS visita_estado
     FROM citas_medicas c
     JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN especialidades e ON e.id = s.especialidad_id
     JOIN medicos m ON m.id = c.medico_id
     JOIN enfermeros en ON en.id = s.enfermero_id
     JOIN residentes r ON r.id = s.residente_id
     LEFT JOIN visitas_medicas v ON v.cita_id = c.id
     WHERE (@estado IS NULL OR c.estado = @estado) AND (@medico IS NULL OR c.medico_id = @medico)
       AND (@enf IS NULL OR s.enfermero_id = @enf)
     ORDER BY c.fecha_hora`,
    { estado, medico, enf: enfermero }
  );
  return res.json(filas);
}));

// POST /api/citas/:citaId/visita  (Especialista asignado) : la solicitud se convierte en visita médica
router.post('/citas/:citaId/visita', verificarToken, permitirRoles(...PERMISOS.atenderVisita), manejar(async (req, res) => {
  const id = req.ids.citaId;
  const visitaId = await transaccion(async (q) => {
    const [c] = await q(
      `SELECT c.id, c.estado, c.precio, c.descuento_pct, m.usuario_id, s.motivo, s.residente_id, e.nombre AS especialidad,
              (SELECT id FROM visitas_medicas WHERE cita_id = c.id) AS visita_id
       FROM citas_medicas c WITH (UPDLOCK) JOIN medicos m ON m.id = c.medico_id
       JOIN solicitudes_medicas s ON s.id = c.solicitud_id JOIN especialidades e ON e.id = s.especialidad_id
       WHERE c.id = @id`, { id }
    );
    if (!c) throw fallo(404, 'La cita no existe.');
    if (c.usuario_id !== req.usuario.id) throw fallo(403, 'Esta cita está asignada a otro médico.');
    if (c.visita_id) return c.visita_id;                         // ya existe: se reutiliza (doble clic)
    if (c.estado !== 'Programada') throw fallo(409, `La cita está ${c.estado.toLowerCase()}.`);
    const [vis] = await q(
      'INSERT INTO visitas_medicas (cita_id, motivo) OUTPUT INSERTED.id VALUES (@c, @motivo)', { c: id, motivo: c.motivo }
    );
    await q("UPDATE citas_medicas SET estado = 'Realizada' WHERE id = @id", { id });
    await crearCargo(q, {
      residenteId: c.residente_id, tipo: 'Consulta', concepto: `Consulta de ${c.especialidad}`,
      montoBase: c.precio, descuento: c.descuento_pct, citaId: id, usuarioId: req.usuario.id,
    });
    return vis.id;
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'visitas_medicas', registroId: visitaId, ip: req.ip });
  res.status(201).json({ id: visitaId });
}));

/* =========================== VISITAS =========================== */

// GET /api/visitas/:visitaId
// Médicos y enfermería ven la visita con la ficha; laboratorio y farmacia solo la parte que les toca.
router.get('/visitas/:visitaId', verificarToken,
  permitirRoles(...CLINICOS, ROLES.LABORATORIO, ROLES.FARMACIA), manejar(async (req, res) => {
    const vis = await leerVisita(consultar, req.ids.visitaId);
    const rol = req.usuario.rol;
    if (rol === ROLES.ESPECIALISTA && !(await especialistaAtiende(consultar, req.usuario.id, vis.residente_id))) {
      throw fallo(403, 'Solo puede ver visitas de internos que usted atiende.');
    }
    const examenes = rol === ROLES.FARMACIA ? [] : await consultar(
      `SELECT id, tipo_examen, indicaciones, estado, resultado, fecha_resultado, precio, descuento_pct, monto
       FROM examenes_laboratorio WHERE visita_id = @id ORDER BY id`, { id: vis.id }
    );
    const medicamentos = rol === ROLES.LABORATORIO ? [] : await consultar(
      `SELECT vm.id, md.nombre + N' ' + md.concentracion + N' (' + md.presentacion + N')' AS medicamento, vm.cantidad, vm.dosis,
              vm.frecuencia, vm.tiempo_aplicacion, vm.indicaciones, vm.estado, vm.monto, vm.entregado_en
       FROM visita_medicamentos vm JOIN medicamentos md ON md.id = vm.medicamento_id WHERE vm.visita_id = @id ORDER BY vm.id`,
      { id: vis.id }
    );
    const respuesta = {
      id: vis.id, estado: vis.estado, fecha_visita: vis.fecha_visita, motivo: vis.motivo, medico: vis.medico,
      especialidad: vis.especialidad, residente_id: vis.residente_id, codigo: vis.codigo, residente: vis.residente,
      es_mi_visita: vis.medico_usuario_id === req.usuario.id, examenes, medicamentos,
    };
    if (CLINICOS.includes(rol)) {
      respuesta.diagnostico = vis.diagnostico;
      respuesta.observaciones = vis.observaciones;
      const [ficha] = await consultar(
        `SELECT CONVERT(char(10), fecha_nacimiento, 23) AS fecha_nacimiento, sexo, tipo_sangre, psicopatologias,
                medicamentos_cajon, alergias, condiciones_medicas FROM residentes WHERE id = @id`, { id: vis.residente_id }
      );
      respuesta.ficha = ficha;
    }
    res.json(respuesta);
  }));

// GET /api/residentes/:residenteId/historial  : historial médico del interno
router.get('/residentes/:residenteId/historial', verificarToken, permitirRoles(...PERMISOS.verHistorial), manejar(async (req, res) => {
  const residenteId = req.ids.residenteId;
  if (req.usuario.rol === ROLES.ESPECIALISTA && !(await especialistaAtiende(consultar, req.usuario.id, residenteId))) {
    throw fallo(403, 'Solo puede ver el historial de internos que usted atiende.');
  }
  const visitas = await consultar(
    `SELECT v.id, v.fecha_visita, v.motivo, v.diagnostico, v.observaciones, v.estado, e.nombre AS especialidad,
            m.nombres + N' ' + m.apellidos AS medico,
            (SELECT COUNT(*) FROM examenes_laboratorio x WHERE x.visita_id = v.id) AS examenes,
            (SELECT COUNT(*) FROM visita_medicamentos x WHERE x.visita_id = v.id) AS medicamentos
     FROM visitas_medicas v JOIN citas_medicas c ON c.id = v.cita_id JOIN medicos m ON m.id = c.medico_id
     JOIN especialidades e ON e.id = m.especialidad_id JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     WHERE s.residente_id = @r ORDER BY v.fecha_visita DESC`, { r: residenteId }
  );
  const solicitudes = await consultar(
    `SELECT s.id, s.fecha_solicitud, s.estado, s.prioridad, s.motivo, e.nombre AS especialidad
     FROM solicitudes_medicas s JOIN especialidades e ON e.id = s.especialidad_id
     WHERE s.residente_id = @r ORDER BY s.fecha_solicitud DESC`, { r: residenteId }
  );
  res.json({ visitas, solicitudes });
}));

// PUT /api/visitas/:visitaId  { diagnostico, observaciones }  (guardar avance)
router.put('/visitas/:visitaId', verificarToken, permitirRoles(...PERMISOS.atenderVisita), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.diagnostico, 'El diagnóstico', { max: 1000 }),
    v.texto(b.observaciones, 'Las observaciones', { max: 1000 }),
  );
  if (v.responderErrores(res, errores)) return;
  const vis = await leerVisita(consultar, req.ids.visitaId);
  exigirDuenoAbierta(vis, req.usuario);
  await consultar('UPDATE visitas_medicas SET diagnostico = @d, observaciones = @o WHERE id = @id',
    { id: vis.id, d: v.limpio(b.diagnostico), o: v.limpio(b.observaciones) });
  res.json({ id: vis.id });
}));

// POST /api/visitas/:visitaId/cerrar  { diagnostico, observaciones } : no se cierra sin diagnóstico
router.post('/visitas/:visitaId/cerrar', verificarToken, permitirRoles(...PERMISOS.atenderVisita), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.diagnostico, 'El diagnóstico', { obligatorio: true, max: 1000 }),
    v.texto(b.observaciones, 'Las observaciones', { max: 1000 }),
  );
  if (errores[0] === 'El diagnóstico es obligatorio.') errores[0] = 'No se puede cerrar la visita sin diagnóstico.';
  if (v.responderErrores(res, errores)) return;
  await transaccion(async (q) => {
    const vis = await leerVisita(q, req.ids.visitaId, true);
    exigirDuenoAbierta(vis, req.usuario);
    await q(`UPDATE visitas_medicas SET diagnostico = @d, observaciones = @o, estado = 'Cerrada', cerrada_en = SYSDATETIME()
             WHERE id = @id`, { id: vis.id, d: v.limpio(b.diagnostico), o: v.limpio(b.observaciones) });
    await q("UPDATE solicitudes_medicas SET estado = 'Atendida' WHERE id = @s", { s: vis.solicitud_id });
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CERRAR', tabla: 'visitas_medicas', registroId: req.ids.visitaId, ip: req.ip });
  res.json({ id: req.ids.visitaId, estado: 'Cerrada' });
}));

// POST /api/visitas/:visitaId/examenes  { tipo_examen, indicaciones }
router.post('/visitas/:visitaId/examenes', verificarToken, permitirRoles(...PERMISOS.atenderVisita), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.tipo_examen, 'El tipo de examen', { obligatorio: true, max: 100 }),
    v.texto(b.indicaciones, 'Las indicaciones', { max: 300 }),
  );
  if (v.responderErrores(res, errores)) return;
  const vis = await leerVisita(consultar, req.ids.visitaId);
  exigirDuenoAbierta(vis, req.usuario);
  const [x] = await consultar(
    'INSERT INTO examenes_laboratorio (visita_id, tipo_examen, indicaciones) OUTPUT INSERTED.id VALUES (@v, @t, @i)',
    { v: vis.id, t: v.limpio(b.tipo_examen), i: v.limpio(b.indicaciones) }
  );
  res.status(201).json({ id: x.id });
}));

// POST /api/visitas/:visitaId/medicamentos  { medicamento_id, cantidad, dosis, frecuencia, tiempo_aplicacion, indicaciones }
router.post('/visitas/:visitaId/medicamentos', verificarToken, permitirRoles(...PERMISOS.atenderVisita), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.medicamento_id, 'El medicamento'),
    v.entero(b.cantidad, 'La cantidad', { min: 1, max: 1000 }),
    v.texto(b.dosis, 'La dosis', { obligatorio: true, max: 60 }),
    v.texto(b.frecuencia, 'La frecuencia', { obligatorio: true, max: 60 }),
    v.texto(b.tiempo_aplicacion, 'El tiempo de aplicación', { obligatorio: true, max: 60 }),
    v.texto(b.indicaciones, 'Las indicaciones', { max: 300 }),
  );
  if (v.responderErrores(res, errores)) return;
  const id = await transaccion(async (q) => {
    const vis = await leerVisita(q, req.ids.visitaId);
    exigirDuenoAbierta(vis, req.usuario);
    const [md] = await q('SELECT id, precio_unitario FROM medicamentos WHERE id = @id AND activo = 1', { id: Number(b.medicamento_id) });
    if (!md) throw fallo(400, 'El medicamento no existe.');
    const d = await descuentos(q);
    const [x] = await q(
      `INSERT INTO visita_medicamentos (visita_id, medicamento_id, cantidad, dosis, frecuencia, tiempo_aplicacion, indicaciones,
                                        precio_unitario, descuento_pct)
       OUTPUT INSERTED.id VALUES (@v, @m, @cant, @dosis, @frec, @tiempo, @ind, @precio, @desc)`,
      { v: vis.id, m: md.id, cant: Number(b.cantidad), dosis: v.limpio(b.dosis), frec: v.limpio(b.frecuencia),
        tiempo: v.limpio(b.tiempo_aplicacion), ind: v.limpio(b.indicaciones), precio: md.precio_unitario, desc: d.farmacia }
    );
    return x.id;
  });
  res.status(201).json({ id });
}));

/* =========================== LABORATORIO =========================== */

// GET /api/laboratorio/examenes?estado=Solicitado
router.get('/laboratorio/examenes', verificarToken, permitirRoles(...PERMISOS.laboratorio, ROLES.ADMIN), manejar(async (req, res) => {
  const estado = ['Solicitado', 'Completado', 'Cancelado'].includes(req.query.estado) ? req.query.estado : 'Solicitado';
  const filas = await consultar(
    `SELECT TOP 300 x.id, x.tipo_examen, x.indicaciones, x.estado, x.resultado, x.fecha_resultado, x.precio, x.monto,
            v.id AS visita_id, v.fecha_visita, m.nombres + N' ' + m.apellidos AS medico, e.nombre AS especialidad,
            r.codigo, r.nombres + N' ' + r.apellidos AS residente
     FROM examenes_laboratorio x JOIN visitas_medicas v ON v.id = x.visita_id JOIN citas_medicas c ON c.id = v.cita_id
     JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
     JOIN solicitudes_medicas s ON s.id = c.solicitud_id JOIN residentes r ON r.id = s.residente_id
     WHERE x.estado = @estado ORDER BY v.fecha_visita`, { estado }
  );
  res.json(filas);
}));

// POST /api/laboratorio/examenes/:examenId/resultado  { resultado, precio }
router.post('/laboratorio/examenes/:examenId/resultado', verificarToken, permitirRoles(...PERMISOS.laboratorio), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.resultado, 'El resultado', { obligatorio: true, max: 2000 }),
    v.monto(b.precio, 'El precio del examen'),
  );
  if (v.responderErrores(res, errores)) return;
  await transaccion(async (q) => {
    const [x] = await q(
      `SELECT x.id, x.estado, x.tipo_examen, s.residente_id FROM examenes_laboratorio x WITH (UPDLOCK)
       JOIN visitas_medicas v ON v.id = x.visita_id JOIN citas_medicas c ON c.id = v.cita_id
       JOIN solicitudes_medicas s ON s.id = c.solicitud_id WHERE x.id = @id`, { id: req.ids.examenId }
    );
    if (!x) throw fallo(404, 'El examen no existe.');
    if (x.estado !== 'Solicitado') throw fallo(409, 'El examen ya tiene resultado o fue cancelado.');
    const d = await descuentos(q);
    await q(
      `UPDATE examenes_laboratorio SET resultado = @res, precio = @precio, descuento_pct = @desc, estado = 'Completado',
              fecha_resultado = SYSDATETIME(), registrado_por = @u WHERE id = @id`,
      { id: x.id, res: v.limpio(b.resultado), precio: Number(b.precio), desc: d.laboratorio, u: req.usuario.id }
    );
    await crearCargo(q, {
      residenteId: x.residente_id, tipo: 'Examen', concepto: `Examen de laboratorio: ${x.tipo_examen}`,
      montoBase: Number(b.precio), descuento: d.laboratorio, examenId: x.id, usuarioId: req.usuario.id,
    });
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'RESULTADO', tabla: 'examenes_laboratorio', registroId: req.ids.examenId, ip: req.ip });
  res.json({ id: req.ids.examenId, estado: 'Completado' });
}));

/* =========================== FARMACIA =========================== */

// GET /api/farmacia/medicamentos?estado=Indicado
router.get('/farmacia/medicamentos', verificarToken, permitirRoles(...PERMISOS.farmacia, ROLES.ADMIN), manejar(async (req, res) => {
  const estado = req.query.estado === 'Entregado' ? 'Entregado' : 'Indicado';
  const filas = await consultar(
    `SELECT TOP 300 vm.id, md.nombre + N' ' + md.concentracion + N' (' + md.presentacion + N')' AS medicamento, vm.cantidad,
            vm.dosis, vm.frecuencia, vm.tiempo_aplicacion, vm.indicaciones, vm.estado, vm.precio_unitario, vm.descuento_pct,
            vm.monto, vm.entregado_en, v.id AS visita_id, v.fecha_visita, m.nombres + N' ' + m.apellidos AS medico,
            r.codigo, r.nombres + N' ' + r.apellidos AS residente
     FROM visita_medicamentos vm JOIN medicamentos md ON md.id = vm.medicamento_id
     JOIN visitas_medicas v ON v.id = vm.visita_id JOIN citas_medicas c ON c.id = v.cita_id
     JOIN medicos m ON m.id = c.medico_id JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN residentes r ON r.id = s.residente_id
     WHERE vm.estado = @estado ORDER BY v.fecha_visita`, { estado }
  );
  res.json(filas);
}));

// POST /api/farmacia/medicamentos/:vmId/entregar
router.post('/farmacia/medicamentos/:vmId/entregar', verificarToken, permitirRoles(...PERMISOS.farmacia), manejar(async (req, res) => {
  await transaccion(async (q) => {
    const [x] = await q(
      `SELECT vm.id, vm.estado, vm.cantidad, vm.precio_unitario, vm.descuento_pct, md.nombre, s.residente_id
       FROM visita_medicamentos vm WITH (UPDLOCK) JOIN medicamentos md ON md.id = vm.medicamento_id
       JOIN visitas_medicas v ON v.id = vm.visita_id JOIN citas_medicas c ON c.id = v.cita_id
       JOIN solicitudes_medicas s ON s.id = c.solicitud_id WHERE vm.id = @id`, { id: req.ids.vmId }
    );
    if (!x) throw fallo(404, 'El medicamento indicado no existe.');
    if (x.estado !== 'Indicado') throw fallo(409, 'Este medicamento ya fue entregado.');
    await q(
      "UPDATE visita_medicamentos SET estado = 'Entregado', entregado_en = SYSDATETIME(), entregado_por = @u WHERE id = @id",
      { id: x.id, u: req.usuario.id }
    );
    await crearCargo(q, {
      residenteId: x.residente_id, tipo: 'Medicamento', concepto: `Medicamento: ${x.nombre} x ${x.cantidad}`,
      montoBase: Number(x.cantidad) * Number(x.precio_unitario), descuento: x.descuento_pct, vmId: x.id, usuarioId: req.usuario.id,
    });
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'ENTREGAR', tabla: 'visita_medicamentos', registroId: req.ids.vmId, ip: req.ip });
  res.json({ id: req.ids.vmId, estado: 'Entregado' });
}));

/* =========================== ENFERMERÍA =========================== */

// GET /api/enfermeria/medicamentos : medicamentos entregados de internos activos (para aplicar)
router.get('/enfermeria/medicamentos', verificarToken, permitirRoles(ROLES.ENFERMERIA, ROLES.ADMIN), manejar(async (req, res) => {
  const filas = await consultar(
    `SELECT TOP 300 vm.id, md.nombre + N' ' + md.concentracion AS medicamento, vm.dosis, vm.frecuencia, vm.tiempo_aplicacion,
            vm.indicaciones, vm.entregado_en, r.codigo, r.nombres + N' ' + r.apellidos AS residente, r.habitacion,
            (SELECT MAX(a.fecha_hora) FROM administracion_medicamentos a WHERE a.visita_medicamento_id = vm.id) AS ultima_aplicacion,
            (SELECT COUNT(*) FROM administracion_medicamentos a WHERE a.visita_medicamento_id = vm.id) AS aplicaciones
     FROM visita_medicamentos vm JOIN medicamentos md ON md.id = vm.medicamento_id
     JOIN visitas_medicas v ON v.id = vm.visita_id JOIN citas_medicas c ON c.id = v.cita_id
     JOIN solicitudes_medicas s ON s.id = c.solicitud_id JOIN residentes r ON r.id = s.residente_id
     WHERE vm.estado = 'Entregado' AND r.estado = 'Activo' ORDER BY r.apellidos`
  );
  res.json(filas);
}));

// POST /api/enfermeria/medicamentos/:vmId/aplicar  { observaciones }
router.post('/enfermeria/medicamentos/:vmId/aplicar', verificarToken, permitirRoles(...PERMISOS.administrarMedicamento), manejar(async (req, res) => {
  const b = req.body || {};
  if (v.responderErrores(res, v.juntar(v.texto(b.observaciones, 'Las observaciones', { max: 300 })))) return;
  const enfermero = await idVinculado(consultar, 'enfermeros', req.usuario.id);
  if (!enfermero) throw fallo(403, 'Su usuario no está vinculado a un enfermero(a).');
  const [x] = await consultar('SELECT estado FROM visita_medicamentos WHERE id = @id', { id: req.ids.vmId });
  if (!x) throw fallo(404, 'El medicamento no existe.');
  if (x.estado !== 'Entregado') throw fallo(409, 'Solo se pueden aplicar medicamentos ya entregados por farmacia.');
  const [a] = await consultar(
    'INSERT INTO administracion_medicamentos (visita_medicamento_id, enfermero_id, observaciones) OUTPUT INSERTED.id VALUES (@vm, @e, @o)',
    { vm: req.ids.vmId, e: enfermero, o: v.limpio(b.observaciones) }
  );
  res.status(201).json({ id: a.id });
}));

module.exports = router;
