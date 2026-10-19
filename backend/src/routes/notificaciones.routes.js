const express = require('express');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../config/roles');
const { manejar } = require('../utils/rutas');
const { reenviarPendientes } = require('../utils/correo');

const router = express.Router();
router.use(verificarToken, permitirRoles(ROLES.ADMIN));

router.get('/', manejar(async (req, res) => {
  res.json(await consultar(
    `SELECT TOP 300 n.id, n.email, n.asunto, n.estado, n.intentos, n.ultimo_error, n.creada_en, n.enviada_en,
            r.nombres + N' ' + r.apellidos AS residente
     FROM notificaciones n JOIN residentes r ON r.id = n.residente_id ORDER BY n.creada_en DESC`
  ));
}));

router.post('/reenviar', manejar(async (req, res) => {
  res.json(await reenviarPendientes());
}));

module.exports = router;
