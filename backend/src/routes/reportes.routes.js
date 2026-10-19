/**
 * Módulo de Reportes (los siete del enunciado).
 * Todos aceptan ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD y, los que son por paciente, ?residente_id=
 */
const express = require('express');
const { consultar } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');
const { manejar } = require('../utils/rutas');
const v = require('../utils/validar');

const router = express.Router();
router.use(verificarToken);

/** Lee y valida los filtros comunes. Responde 400 si son inválidos. */
function filtros(req, res, { residenteObligatorio = false } = {}) {
  const q = req.query;
  const errores = v.juntar(
    v.fecha(q.desde, 'La fecha inicial', { obligatorio: false }),
    v.fecha(q.hasta, 'La fecha final', { obligatorio: false }),
    residenteObligatorio || !v.vacio(q.residente_id) ? v.id(q.residente_id, 'El interno') : null,
  );
  if (!errores.length && q.desde && q.hasta && q.desde > q.hasta) errores.push('La fecha inicial no puede ser mayor que la final.');
  if (v.responderErrores(res, errores)) return null;
  return {
    desde: v.limpio(q.desde),
    hasta: v.limpio(q.hasta),
    r: v.vacio(q.residente_id) ? null : Number(q.residente_id),
  };
}

const rango = (col) => `(@desde IS NULL OR CAST(${col} AS DATE) >= @desde) AND (@hasta IS NULL OR CAST(${col} AS DATE) <= @hasta)`;
const suma = (filas, campo) => Number(filas.reduce((s, f) => s + Number(f[campo] || 0), 0).toFixed(2));

// 1. Informe estadístico de costos de cada cita por paciente (incluye exámenes y medicamentos)
router.get('/costos-citas', permitirRoles(...PERMISOS.reportesFinancieros), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const citas = await consultar(
    `SELECT d.cita_id, d.fecha_hora, r.id AS residente_id, r.codigo, r.nombres + N' ' + r.apellidos AS residente,
            e.nombre AS especialidad, m.nombres + N' ' + m.apellidos AS medico,
            d.costo_consulta, d.costo_examenes, d.costo_medicamentos, d.costo_total, d.pagado, d.saldo, d.estado_pago
     FROM v_deuda_fundacion_cita d JOIN residentes r ON r.id = d.residente_id
     JOIN citas_medicas c ON c.id = d.cita_id JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
     WHERE (@r IS NULL OR d.residente_id = @r) AND ${rango('d.fecha_hora')}
     ORDER BY r.apellidos, d.fecha_hora`, f
  );
  // Estadísticas por paciente y por especialidad
  const agrupar = (clave, nombre) => Object.values(citas.reduce((acc, c) => {
    const k = c[clave];
    acc[k] = acc[k] || { [nombre]: c[nombre === 'residente' ? 'residente' : 'especialidad'], citas: 0, total: 0 };
    acc[k].citas += 1; acc[k].total = Number((acc[k].total + Number(c.costo_total)).toFixed(2));
    return acc;
  }, {}));
  res.json({
    filas: citas,
    totales: {
      citas: citas.length, consultas: suma(citas, 'costo_consulta'), examenes: suma(citas, 'costo_examenes'),
      medicamentos: suma(citas, 'costo_medicamentos'), total: suma(citas, 'costo_total'),
      promedio_por_cita: citas.length ? Number((suma(citas, 'costo_total') / citas.length).toFixed(2)) : 0,
    },
    por_paciente: agrupar('residente_id', 'residente'),
    por_especialidad: agrupar('especialidad', 'especialidad'),
  });
}));

// 2. Análisis médicos por paciente: ficha médica, por qué fue atendido y medicamentos
router.get('/analisis-medicos', permitirRoles(...PERMISOS.reportesMedicos), manejar(async (req, res) => {
  const f = filtros(req, res, { residenteObligatorio: true }); if (!f) return;
  const [ficha] = await consultar(
    `SELECT codigo, nombres + N' ' + apellidos AS residente, CONVERT(char(10), fecha_nacimiento, 23) AS fecha_nacimiento,
            DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) AS edad, sexo, tipo_sangre, CONVERT(char(10), fecha_ingreso, 23) AS fecha_ingreso,
            estado, psicopatologias, medicamentos_cajon, alergias, condiciones_medicas, observaciones
     FROM residentes WHERE id = @r`, f
  );
  if (!ficha) return res.status(404).json({ mensaje: 'El interno no existe.' });
  const visitas = await consultar(
    `SELECT v.id, v.fecha_visita, v.motivo, v.diagnostico, v.observaciones, v.estado, e.nombre AS especialidad,
            m.nombres + N' ' + m.apellidos AS medico,
            ISNULL(STUFF((SELECT N'; ' + md.nombre + N' ' + md.concentracion + N' x' + CAST(vm.cantidad AS NVARCHAR(10))
                          + N' (' + vm.dosis + N', ' + vm.frecuencia + N', ' + vm.tiempo_aplicacion + N')'
                          FROM visita_medicamentos vm JOIN medicamentos md ON md.id = vm.medicamento_id
                          WHERE vm.visita_id = v.id FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, N''), N'') AS medicamentos,
            ISNULL(STUFF((SELECT N'; ' + x.tipo_examen + ISNULL(N': ' + x.resultado, N' (pendiente)')
                          FROM examenes_laboratorio x WHERE x.visita_id = v.id FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, N''), N'') AS examenes
     FROM visitas_medicas v JOIN citas_medicas c ON c.id = v.cita_id JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
     WHERE s.residente_id = @r AND ${rango('v.fecha_visita')} ORDER BY v.fecha_visita`, f
  );
  return res.json({ ficha, filas: visitas, totales: { visitas: visitas.length } });
}));

// 3. Cobros por paciente por rango de fecha (con los gastos médicos como detalle)
router.get('/cobros', permitirRoles(...PERMISOS.reportesFinancieros), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const cargos = await consultar(
    `SELECT c.id, c.fecha, r.codigo, r.nombres + N' ' + r.apellidos AS residente, c.tipo, c.concepto, c.monto_base, c.descuento_pct,
            c.monto, c.estado, ISNULL((SELECT SUM(p.monto) FROM pagos p WHERE p.cargo_id = c.id), 0) AS pagado
     FROM cargos c JOIN residentes r ON r.id = c.residente_id
     WHERE (@r IS NULL OR c.residente_id = @r) AND ${rango('c.fecha')} ORDER BY r.apellidos, c.fecha`, f
  );
  const pagos = await consultar(
    `SELECT p.numero_recibo, p.fecha, r.nombres + N' ' + r.apellidos AS residente, c.concepto, p.metodo, p.monto
     FROM pagos p JOIN cargos c ON c.id = p.cargo_id JOIN residentes r ON r.id = p.residente_id
     WHERE (@r IS NULL OR p.residente_id = @r) AND ${rango('p.fecha')} ORDER BY p.fecha`, f
  );
  const medicos = cargos.filter((c) => ['Consulta', 'Examen', 'Medicamento'].includes(c.tipo));
  res.json({
    filas: cargos.map((c) => ({ ...c, saldo: Number((c.monto - c.pagado).toFixed(2)) })),
    pagos,
    totales: {
      cargado: suma(cargos, 'monto'), gastos_medicos: suma(medicos, 'monto'), cuotas: suma(cargos.filter((c) => c.tipo === 'Cuota'), 'monto'),
      descuento_fundacion: Number(medicos.reduce((s, c) => s + Number(c.monto_base) - Number(c.monto), 0).toFixed(2)),
      cobrado: suma(pagos, 'monto'),
    },
  });
}));

// 4. Pagos a la fundación
router.get('/pagos-fundacion', permitirRoles(...PERMISOS.reportesFinancieros), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const filas = await consultar(
    `SELECT pf.id, pf.fecha, pf.monto, pf.comprobante, c.fecha_hora AS fecha_cita, r.nombres + N' ' + r.apellidos AS residente,
            e.nombre AS especialidad
     FROM pagos_fundacion pf JOIN citas_medicas c ON c.id = pf.cita_id JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN residentes r ON r.id = s.residente_id JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
     WHERE (@r IS NULL OR s.residente_id = @r) AND ${rango('pf.fecha')} ORDER BY pf.fecha`, f
  );
  const [deuda] = await consultar('SELECT ISNULL(SUM(saldo), 0) AS pendiente FROM v_deuda_fundacion_cita');
  res.json({ filas, totales: { pagado: suma(filas, 'monto'), pagos: filas.length, deuda_pendiente: deuda.pendiente } });
}));

// 5. Entradas: donaciones y cobros
router.get('/entradas', permitirRoles(...PERMISOS.reportesFinancieros), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const filas = await consultar(
    `SELECT fecha, N'Donación' AS origen, tipo_donante AS detalle, donante AS de_quien, numero_recibo AS documento, monto
     FROM donaciones WHERE ${rango('fecha')}
     UNION ALL
     SELECT p.fecha, N'Cobro', c.tipo + N': ' + c.concepto, ISNULL(fa.nombres + N' ' + fa.apellidos, r.nombres + N' ' + r.apellidos),
            p.numero_recibo, p.monto
     FROM pagos p JOIN cargos c ON c.id = p.cargo_id JOIN residentes r ON r.id = p.residente_id LEFT JOIN familiares fa ON fa.id = p.familiar_id
     WHERE ${rango('p.fecha')}
     ORDER BY fecha`, f
  );
  const don = filas.filter((x) => x.origen === 'Donación');
  const porTipo = Object.values(don.reduce((a, d) => {
    a[d.detalle] = a[d.detalle] || { tipo_donante: d.detalle, cantidad: 0, total: 0 };
    a[d.detalle].cantidad += 1; a[d.detalle].total = Number((a[d.detalle].total + Number(d.monto)).toFixed(2));
    return a;
  }, {}));
  res.json({ filas, por_tipo_donante: porTipo, totales: { donaciones: suma(don, 'monto'), cobros: suma(filas.filter((x) => x.origen === 'Cobro'), 'monto'), total: suma(filas, 'monto') } });
}));

// 6. Exámenes médicos realizados por paciente
router.get('/examenes', permitirRoles(...PERMISOS.reportesMedicos), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const filas = await consultar(
    `SELECT x.id, r.codigo, r.nombres + N' ' + r.apellidos AS residente, x.tipo_examen, x.estado, x.resultado, x.fecha_resultado,
            v.fecha_visita, m.nombres + N' ' + m.apellidos AS medico, e.nombre AS especialidad, x.precio, x.descuento_pct, x.monto
     FROM examenes_laboratorio x JOIN visitas_medicas v ON v.id = x.visita_id JOIN citas_medicas c ON c.id = v.cita_id
     JOIN solicitudes_medicas s ON s.id = c.solicitud_id JOIN residentes r ON r.id = s.residente_id
     JOIN medicos m ON m.id = c.medico_id JOIN especialidades e ON e.id = m.especialidad_id
     WHERE (@r IS NULL OR s.residente_id = @r) AND ${rango('v.fecha_visita')} ORDER BY r.apellidos, v.fecha_visita`, f
  );
  const hechos = filas.filter((x) => x.estado === 'Completado');
  res.json({ filas, totales: { examenes: filas.length, completados: hechos.length, pendientes: filas.length - hechos.length, costo: suma(hechos, 'monto') } });
}));

// 7. Medicamentos aplicados por paciente (entregados por farmacia y aplicaciones de enfermería)
router.get('/medicamentos', permitirRoles(...PERMISOS.reportesMedicos), manejar(async (req, res) => {
  const f = filtros(req, res); if (!f) return;
  const filas = await consultar(
    `SELECT vm.id, r.codigo, r.nombres + N' ' + r.apellidos AS residente, md.nombre + N' ' + md.concentracion AS medicamento,
            vm.cantidad, vm.dosis, vm.frecuencia, vm.tiempo_aplicacion, vm.estado, vm.entregado_en, v.fecha_visita,
            m.nombres + N' ' + m.apellidos AS medico, vm.monto,
            (SELECT COUNT(*) FROM administracion_medicamentos a WHERE a.visita_medicamento_id = vm.id) AS aplicaciones
     FROM visita_medicamentos vm JOIN medicamentos md ON md.id = vm.medicamento_id JOIN visitas_medicas v ON v.id = vm.visita_id
     JOIN citas_medicas c ON c.id = v.cita_id JOIN solicitudes_medicas s ON s.id = c.solicitud_id
     JOIN residentes r ON r.id = s.residente_id JOIN medicos m ON m.id = c.medico_id
     WHERE (@r IS NULL OR s.residente_id = @r) AND ${rango('v.fecha_visita')} ORDER BY r.apellidos, v.fecha_visita`, f
  );
  const entregados = filas.filter((x) => x.estado === 'Entregado');
  res.json({ filas, totales: { indicados: filas.length, entregados: entregados.length, aplicaciones: suma(filas, 'aplicaciones'), costo: suma(entregados, 'monto') } });
}));

module.exports = router;
