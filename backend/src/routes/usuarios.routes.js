const express = require('express');
const bcrypt = require('bcryptjs');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { validarUsuario, idValido } = require('../validators/validaciones');
const { PERMISOS } = require('../config/roles');
const { registrarAuditoria } = require('../utils/auditoria');

const router = express.Router();

// No existe registro público: solo el Administrador crea usuarios.
router.use(verificarToken, permitirRoles(...PERMISOS.gestionarUsuarios));

// GET /api/usuarios
router.get('/', async (req, res, next) => {
  try {
    const filas = await consultar(
      `SELECT u.id, u.nombres, u.apellidos, u.email, r.nombre AS rol, u.activo, u.ultimo_acceso, u.creado_en
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       ORDER BY u.apellidos, u.nombres`
    );
    res.json(filas);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios
router.post('/', async (req, res, next) => {
  try {
    const errores = validarUsuario(req.body);
    if (errores.length) return res.status(400).json({ mensaje: errores[0], errores });

    const { nombres, apellidos, password, rol } = req.body;
    const email = req.body.email.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);

    const filas = await consultar(
      `INSERT INTO usuarios (nombres, apellidos, email, password_hash, rol_id)
       OUTPUT INSERTED.id
       SELECT @nombres, @apellidos, @email, @hash, id FROM roles WHERE nombre = @rol`,
      { nombres: nombres.trim(), apellidos: apellidos.trim(), email, hash, rol }
    );
    const id = filas[0].id;
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'usuarios', registroId: id, detalle: `${email} (${rol})`, ip: req.ip });
    return res.status(201).json({ id, nombres, apellidos, email, rol, activo: true });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/usuarios/:id/estado   { activo: true|false }
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ mensaje: 'El identificador no es válido.' });
    if (!req.body || typeof req.body.activo !== 'boolean') return res.status(400).json({ mensaje: 'Indique activo: true o false.' });
    if (id === req.usuario.id && req.body.activo === false) {
      return res.status(400).json({ mensaje: 'No puede desactivar su propio usuario.' });
    }
    const filas = await consultar(
      'UPDATE usuarios SET activo = @activo OUTPUT INSERTED.id WHERE id = @id',
      { id, activo: req.body.activo }
    );
    if (!filas.length) return res.status(404).json({ mensaje: 'El usuario no existe.' });
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CAMBIAR_ESTADO', tabla: 'usuarios', registroId: id, detalle: `activo=${req.body.activo}`, ip: req.ip });
    return res.json({ id, activo: req.body.activo });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
