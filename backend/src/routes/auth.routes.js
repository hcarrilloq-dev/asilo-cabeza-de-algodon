const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { consultar } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { validarLogin } = require('../validators/validaciones');
const { registrarAuditoria } = require('../utils/auditoria');

const router = express.Router();

// Máximo 10 intentos de inicio de sesión cada 15 minutos por IP
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Espere 15 minutos e intente de nuevo.' },
});

// POST /api/auth/login
router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const errores = validarLogin(req.body);
    if (errores.length) return res.status(400).json({ mensaje: errores[0], errores });

    const email = req.body.email.trim().toLowerCase();
    const filas = await consultar(
      `SELECT u.id, u.nombres, u.apellidos, u.email, u.password_hash, u.activo, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.email = @email`,
      { email }
    );
    const usuario = filas[0];
    const credencialesOk = usuario && (await bcrypt.compare(req.body.password, usuario.password_hash));

    if (!credencialesOk) {
      await registrarAuditoria({ usuarioId: usuario ? usuario.id : null, accion: 'LOGIN_FALLIDO', detalle: email, ip: req.ip });
      // Mismo mensaje para correo o contraseña incorrectos: no revela qué cuentas existen
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }
    if (!usuario.activo) {
      return res.status(403).json({ mensaje: 'Su usuario está desactivado. Contacte al administrador.' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: `${usuario.nombres} ${usuario.apellidos}` },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );

    await consultar('UPDATE usuarios SET ultimo_acceso = SYSDATETIME() WHERE id = @id', { id: usuario.id });
    await registrarAuditoria({ usuarioId: usuario.id, accion: 'LOGIN', ip: req.ip });

    return res.json({
      token,
      usuario: { id: usuario.id, nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/perfil  (datos del usuario con sesión iniciada)
router.get('/perfil', verificarToken, async (req, res, next) => {
  try {
    const filas = await consultar(
      `SELECT u.id, u.nombres, u.apellidos, u.email, r.nombre AS rol, u.activo
       FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = @id`,
      { id: req.usuario.id }
    );
    if (!filas[0] || !filas[0].activo) return res.status(401).json({ mensaje: 'El usuario ya no está activo.' });
    const { activo, ...usuario } = filas[0];
    return res.json(usuario);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
