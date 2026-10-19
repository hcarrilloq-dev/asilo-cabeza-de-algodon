/** Portal del familiar responsable: solo ve a sus internos, su cuenta y sus citas (sin datos clínicos sensibles). */
const express = require('express');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');
const { manejar } = require('../utils/rutas');

const router = express.Router();
router.use(verificarToken, permitirRoles(...PERMISOS.portalFamiliar));

router.get('/', manejar(async (req, res) => {
  const internos = await consultar(
    `SELECT r.id, r.codigo, r.nombres + N' ' + r.apellidos AS residente, r.estado, rf.parentesco, rf.es_responsable,
            ec.total_cargos, ec.total_pagos, ec.saldo
     FROM familiares f JOIN residente_familiar rf ON rf.familiar_id = f.id JOIN residentes r ON r.id = rf.residente_id
     JOIN v_estado_cuenta ec ON ec.residente_id = r.id WHERE f.usuario_id = @u`, { u: req.usuario.id }
  );
  for (const i of internos) {
    i.cargos = await consultar(
      `SELECT c.id, c.fecha, c.tipo, c.concepto, c.monto_base, c.descuento_pct, c.monto, c.estado,
              ISNULL((SELECT SUM(monto) FROM pagos WHERE cargo_id = c.id), 0) AS pagado
       FROM cargos c WHERE c.residente_id = @r ORDER BY c.fecha DESC`, { r: i.id }
    );
    i.citas = await consultar(
      `SELECT s.fecha_solicitud, s.estado, e.nombre AS especialidad, c.fecha_hora, m.nombres + N' ' + m.apellidos AS medico
       FROM solicitudes_medicas s JOIN especialidades e ON e.id = s.especialidad_id
       LEFT JOIN citas_medicas c ON c.solicitud_id = s.id LEFT JOIN medicos m ON m.id = c.medico_id
       WHERE s.residente_id = @r ORDER BY s.fecha_solicitud DESC`, { r: i.id }
    );
  }
  res.json({ internos });
}));

module.exports = router;
