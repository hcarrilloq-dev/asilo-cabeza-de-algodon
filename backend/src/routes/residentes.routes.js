const express = require('express');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { validarResidente, ESTADOS_RESIDENTE, idValido } = require('../validators/validaciones');
const { PERMISOS } = require('../config/roles');
const { registrarAuditoria } = require('../utils/auditoria');

const router = express.Router();
router.use(verificarToken);

const LECTURA = PERMISOS.verResidentes;
const ESCRITURA = PERMISOS.editarResidentes;

// Valida el :id de la ruta antes de llegar a la base de datos
router.param('id', (req, res, next, valor) => {
  const id = idValido(valor);
  if (!id) return res.status(400).json({ mensaje: 'El identificador no es válido.' });
  req.idRegistro = id;
  return next();
});

const COLUMNAS = `id, codigo, nombres, apellidos, dpi,
  CONVERT(char(10), fecha_nacimiento, 23) AS fecha_nacimiento, sexo,
  CONVERT(char(10), fecha_ingreso, 23) AS fecha_ingreso, estado, tipo_sangre, alergias,
  psicopatologias, medicamentos_cajon, condiciones_medicas, habitacion, observaciones`;

const limpiar = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

function parametros(body) {
  return {
    nombres: limpiar(body.nombres),
    apellidos: limpiar(body.apellidos),
    dpi: limpiar(body.dpi),
    fechaNacimiento: body.fecha_nacimiento,
    sexo: body.sexo,
    fechaIngreso: limpiar(body.fecha_ingreso),
    tipoSangre: limpiar(body.tipo_sangre),
    alergias: limpiar(body.alergias),
    condiciones: limpiar(body.condiciones_medicas),
    psicopatologias: limpiar(body.psicopatologias),
    medicamentosCajon: limpiar(body.medicamentos_cajon),
    habitacion: limpiar(body.habitacion),
    observaciones: limpiar(body.observaciones),
  };
}

// GET /api/residentes?buscar=texto&estado=Activo
router.get('/', permitirRoles(...LECTURA), async (req, res, next) => {
  try {
    const buscar = limpiar(req.query.buscar);
    const estado = ESTADOS_RESIDENTE.includes(req.query.estado) ? req.query.estado : null;
    const filas = await consultar(
      `SELECT ${COLUMNAS} FROM residentes
       WHERE (@buscar IS NULL OR nombres LIKE @patron OR apellidos LIKE @patron OR codigo LIKE @patron OR dpi LIKE @patron)
         AND (@estado IS NULL OR estado = @estado)
       ORDER BY apellidos, nombres`,
      { buscar, patron: buscar ? `%${buscar}%` : null, estado }
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
});

// GET /api/residentes/:id
router.get('/:id', permitirRoles(...LECTURA), async (req, res, next) => {
  try {
    const filas = await consultar(`SELECT ${COLUMNAS} FROM residentes WHERE id = @id`, { id: req.idRegistro });
    if (!filas.length) return res.status(404).json({ mensaje: 'El residente no existe.' });
    return res.json(filas[0]);
  } catch (err) {
    return next(err);
  }
});

// POST /api/residentes
router.post('/', permitirRoles(...ESCRITURA), async (req, res, next) => {
  try {
    const errores = validarResidente(req.body);
    if (errores.length) return res.status(400).json({ mensaje: errores[0], errores });

    const p = parametros(req.body);
    const filas = await consultar(
      `DECLARE @sig INT = ISNULL((SELECT MAX(id) FROM residentes), 0) + 1;
       INSERT INTO residentes (codigo, nombres, apellidos, dpi, fecha_nacimiento, sexo, fecha_ingreso,
                               tipo_sangre, alergias, condiciones_medicas, psicopatologias, medicamentos_cajon, habitacion, observaciones, creado_por)
       OUTPUT INSERTED.id, INSERTED.codigo
       VALUES ('RES-' + RIGHT('0000' + CAST(@sig AS VARCHAR(10)), 4), @nombres, @apellidos, @dpi, @fechaNacimiento, @sexo,
               ISNULL(@fechaIngreso, CAST(SYSDATETIME() AS DATE)), @tipoSangre, @alergias, @condiciones,
               @psicopatologias, @medicamentosCajon, @habitacion, @observaciones, @usuarioId)`,
      { ...p, usuarioId: req.usuario.id }
    );
    const { id, codigo } = filas[0];
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'residentes', registroId: id, detalle: codigo, ip: req.ip });
    return res.status(201).json({ id, codigo });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/residentes/:id
router.put('/:id', permitirRoles(...ESCRITURA), async (req, res, next) => {
  try {
    const errores = validarResidente(req.body);
    if (errores.length) return res.status(400).json({ mensaje: errores[0], errores });

    const id = req.idRegistro;
    const filas = await consultar(
      `UPDATE residentes SET nombres=@nombres, apellidos=@apellidos, dpi=@dpi, fecha_nacimiento=@fechaNacimiento,
         sexo=@sexo, fecha_ingreso=ISNULL(@fechaIngreso, fecha_ingreso), tipo_sangre=@tipoSangre, alergias=@alergias,
         condiciones_medicas=@condiciones, psicopatologias=@psicopatologias,
         medicamentos_cajon=@medicamentosCajon, habitacion=@habitacion, observaciones=@observaciones,
         actualizado_en=SYSDATETIME()
       OUTPUT INSERTED.id
       WHERE id=@id`,
      { ...parametros(req.body), id }
    );
    if (!filas.length) return res.status(404).json({ mensaje: 'El residente no existe.' });
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'EDITAR', tabla: 'residentes', registroId: id, ip: req.ip });
    return res.json({ id });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/residentes/:id/estado   { estado: 'Egresado', motivo: '...' }
// Los residentes no se eliminan: se cambia su estado (se conserva el historial).
router.patch('/:id/estado', permitirRoles(...ESCRITURA), async (req, res, next) => {
  try {
    const { estado, motivo } = req.body || {};
    if (motivo !== undefined && motivo !== null && (typeof motivo !== 'string' || motivo.length > 300)) {
      return res.status(400).json({ mensaje: 'El motivo debe ser texto de máximo 300 caracteres.' });
    }
    if (!ESTADOS_RESIDENTE.includes(estado)) {
      return res.status(400).json({ mensaje: `El estado debe ser uno de: ${ESTADOS_RESIDENTE.join(', ')}.` });
    }
    const id = req.idRegistro;
    const filas = await consultar(
      'UPDATE residentes SET estado=@estado, actualizado_en=SYSDATETIME() OUTPUT INSERTED.id WHERE id=@id',
      { id, estado }
    );
    if (!filas.length) return res.status(404).json({ mensaje: 'El residente no existe.' });
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CAMBIAR_ESTADO', tabla: 'residentes', registroId: id, detalle: `${estado}${motivo ? `: ${motivo}` : ''}`, ip: req.ip });
    return res.json({ id, estado });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
