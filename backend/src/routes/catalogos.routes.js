const express = require('express');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');
const { manejar } = require('../utils/rutas');
const v = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');

const router = express.Router();
router.use(verificarToken);

async function leerConfiguracion() {
  const filas = await consultar('SELECT clave, valor FROM configuracion');
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

// GET /api/catalogos : listas para los formularios
router.get('/', permitirRoles(...PERMISOS.catalogos), manejar(async (req, res) => {
  const [especialidades, medicos, enfermeros, medicamentos, configuracion] = await Promise.all([
    consultar('SELECT id, nombre FROM especialidades ORDER BY nombre'),
    consultar(`SELECT m.id, m.nombres, m.apellidos, m.tipo, m.especialidad_id, e.nombre AS especialidad
               FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id WHERE m.activo = 1
               ORDER BY e.nombre, m.apellidos`),
    consultar('SELECT id, nombres, apellidos, turno FROM enfermeros WHERE activo = 1 ORDER BY apellidos'),
    consultar(`SELECT id, nombre, presentacion, concentracion, precio_unitario FROM medicamentos
               WHERE activo = 1 ORDER BY nombre`),
    leerConfiguracion(),
  ]);
  res.json({ especialidades, medicos, enfermeros, medicamentos, configuracion });
}));

// PUT /api/catalogos/configuracion  { descuento_consulta, descuento_laboratorio, descuento_farmacia, precio_consulta }
router.put('/configuracion', permitirRoles(...PERMISOS.configuracion), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.porcentaje(b.descuento_consulta, 'El descuento en consultas') || (v.vacio(b.descuento_consulta) && 'El descuento en consultas es obligatorio.'),
    v.porcentaje(b.descuento_laboratorio, 'El descuento en laboratorio') || (v.vacio(b.descuento_laboratorio) && 'El descuento en laboratorio es obligatorio.'),
    v.porcentaje(b.descuento_farmacia, 'El descuento en farmacia') || (v.vacio(b.descuento_farmacia) && 'El descuento en farmacia es obligatorio.'),
    v.monto(b.precio_consulta, 'El precio de la consulta'),
  );
  if (v.responderErrores(res, errores)) return;
  for (const clave of ['descuento_consulta', 'descuento_laboratorio', 'descuento_farmacia', 'precio_consulta']) {
    await consultar('UPDATE configuracion SET valor = @valor WHERE clave = @clave', { clave, valor: String(Number(b[clave])) });
  }
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'EDITAR', tabla: 'configuracion', ip: req.ip });
  res.json(await leerConfiguracion());
}));

// POST /api/catalogos/medicamentos (Administrador)
router.post('/medicamentos', permitirRoles(...PERMISOS.configuracion), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.nombre, 'El nombre', { obligatorio: true, max: 100 }),
    v.texto(b.presentacion, 'La presentación', { obligatorio: true, max: 50 }),
    v.texto(b.concentracion, 'La concentración', { max: 30 }),
    v.monto(b.precio_unitario, 'El precio unitario'),
  );
  if (v.responderErrores(res, errores)) return;
  const [f] = await consultar(
    `INSERT INTO medicamentos (nombre, presentacion, concentracion, precio_unitario) OUTPUT INSERTED.id
     VALUES (@nombre, @presentacion, ISNULL(@concentracion, N''), @precio)`,
    { nombre: v.limpio(b.nombre), presentacion: v.limpio(b.presentacion), concentracion: v.limpio(b.concentracion), precio: Number(b.precio_unitario) }
  );
  res.status(201).json({ id: f.id });
}));

// POST /api/catalogos/medicos (Administrador)
router.post('/medicos', permitirRoles(...PERMISOS.configuracion), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.nombres, 'Los nombres', { obligatorio: true, max: 80 }),
    v.texto(b.apellidos, 'Los apellidos', { obligatorio: true, max: 80 }),
    v.texto(b.colegiado, 'El colegiado', { max: 20 }),
    v.id(b.especialidad_id, 'La especialidad'),
    v.opcion(b.tipo, 'El tipo', ['General', 'Especialista']),
    v.telefono(b.telefono, { obligatorio: false }),
  );
  if (v.responderErrores(res, errores)) return;
  const [f] = await consultar(
    `INSERT INTO medicos (nombres, apellidos, colegiado, especialidad_id, tipo, telefono) OUTPUT INSERTED.id
     VALUES (@nombres, @apellidos, @colegiado, @especialidad, @tipo, @telefono)`,
    { nombres: v.limpio(b.nombres), apellidos: v.limpio(b.apellidos), colegiado: v.limpio(b.colegiado),
      especialidad: Number(b.especialidad_id), tipo: b.tipo, telefono: v.limpio(b.telefono) }
  );
  res.status(201).json({ id: f.id });
}));

// POST /api/catalogos/enfermeros (Administrador)
router.post('/enfermeros', permitirRoles(...PERMISOS.configuracion), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.texto(b.nombres, 'Los nombres', { obligatorio: true, max: 80 }),
    v.texto(b.apellidos, 'Los apellidos', { obligatorio: true, max: 80 }),
    v.opcion(b.turno, 'El turno', ['Matutino', 'Vespertino', 'Nocturno']),
    v.telefono(b.telefono, { obligatorio: false }),
  );
  if (v.responderErrores(res, errores)) return;
  const [f] = await consultar(
    `INSERT INTO enfermeros (nombres, apellidos, turno, telefono) OUTPUT INSERTED.id VALUES (@nombres, @apellidos, @turno, @telefono)`,
    { nombres: v.limpio(b.nombres), apellidos: v.limpio(b.apellidos), turno: b.turno, telefono: v.limpio(b.telefono) }
  );
  res.status(201).json({ id: f.id });
}));

module.exports = router;
module.exports.leerConfiguracion = leerConfiguracion;
