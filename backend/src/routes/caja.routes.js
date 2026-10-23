/**
 * Módulo de Entradas, Salidas y Manejo de Caja.
 * - Cargos a la cuenta del familiar (con descuento) y sus pagos
 * - Cuotas mensuales, donaciones y gastos
 * - Deuda y pagos a la fundación por cita
 */
const express = require('express');
const crypto = require('crypto');
const { consultar, transaccion } = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { PERMISOS } = require('../config/roles');
const { paramId, manejar, fallo } = require('../utils/rutas');
const v = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');

const router = express.Router();
router.use(verificarToken);
paramId(router, 'residenteId');
paramId(router, 'cargoId');

const METODOS = ['Efectivo', 'Transferencia', 'Deposito', 'Tarjeta'];
const TIPOS_DONANTE = ['Empresa internacional', 'Empresa nacional', 'Gobierno', 'Particular'];
const CATEGORIAS_GASTO = ['Luz', 'Agua', 'Telefono e internet', 'Alimentacion', 'Mantenimiento', 'Salarios', 'Insumos', 'Otro'];

/** La clave de operación la genera el navegador al abrir el formulario: si llega dos veces, es el mismo pago. */
function claveOperacion(valor) {
  if (typeof valor === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(valor)) return valor;
  return crypto.randomUUID();
}

/** Siguiente número de documento (REC-000001, DON-000001) dentro de la transacción. */
async function siguienteNumero(q, tabla, prefijo) {
  const [f] = await q(`SELECT ISNULL(MAX(id), 0) + 1 AS n FROM ${tabla} WITH (UPDLOCK, HOLDLOCK)`);
  return `${prefijo}-${String(f.n).padStart(6, '0')}`;
}

/** Marca como vencidos los cargos con fecha de vencimiento pasada que no están cancelados. */
const actualizarVencidos = () => consultar(
  `UPDATE cargos SET estado = 'Vencido'
   WHERE estado IN ('Pendiente','Parcial') AND fecha_vencimiento < CAST(SYSDATETIME() AS DATE)`
);

function rangoFechas(query) {
  const desde = v.fecha(query.desde, 'desde') ? null : query.desde;
  const hasta = v.fecha(query.hasta, 'hasta') ? null : query.hasta;
  return { desde, hasta };
}

/* =========================== CARGOS Y PAGOS =========================== */

// GET /api/caja/cargos?residente_id=&estado=
router.get('/cargos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  await actualizarVencidos();
  const residente = v.id(req.query.residente_id, 'x') ? null : Number(req.query.residente_id);
  const estado = ['Pendiente', 'Parcial', 'Cancelado', 'Vencido'].includes(req.query.estado) ? req.query.estado : null;
  const conSaldo = req.query.estado === 'ConSaldo';   // Pendiente, Parcial o Vencido
  const filas = await consultar(
    `SELECT TOP 500 c.id, c.tipo, c.concepto, c.monto_base, c.descuento_pct, c.monto, c.estado, c.periodo, c.fecha,
            c.fecha_vencimiento, r.id AS residente_id, r.codigo, r.nombres + N' ' + r.apellidos AS residente,
            f.nombres + N' ' + f.apellidos AS familiar,
            ISNULL((SELECT SUM(p.monto) FROM pagos p WHERE p.cargo_id = c.id), 0) AS pagado
     FROM cargos c JOIN residentes r ON r.id = c.residente_id LEFT JOIN familiares f ON f.id = c.familiar_id
     WHERE (@r IS NULL OR c.residente_id = @r) AND (@estado IS NULL OR c.estado = @estado)
       AND (@conSaldo = 0 OR c.estado IN ('Pendiente','Parcial','Vencido'))
     ORDER BY c.fecha DESC, c.id DESC`, { r: residente, estado, conSaldo: conSaldo ? 1 : 0 }
  );
  res.json(filas.map((f) => ({ ...f, saldo: Number((f.monto - f.pagado).toFixed(2)) })));
}));

// POST /api/caja/cargos  { residente_id, concepto, monto_base, descuento_pct, fecha_vencimiento }  (cargo manual "Otro")
router.post('/cargos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.residente_id, 'El interno'),
    v.texto(b.concepto, 'El concepto', { obligatorio: true, max: 200 }),
    v.monto(b.monto_base, 'El monto'),
    v.porcentaje(b.descuento_pct),
    v.fecha(b.fecha_vencimiento, 'La fecha de vencimiento', { obligatorio: false }),
  );
  if (v.responderErrores(res, errores)) return;
  const [f] = await consultar(
    `INSERT INTO cargos (residente_id, familiar_id, tipo, concepto, monto_base, descuento_pct, fecha_vencimiento, creado_por)
     OUTPUT INSERTED.id, INSERTED.monto
     SELECT r.id, (SELECT familiar_id FROM residente_familiar WHERE residente_id = r.id AND es_responsable = 1),
            'Otro', @concepto, @base, @desc, COALESCE(TRY_CAST(@venc AS DATE), DATEADD(DAY, 30, CAST(SYSDATETIME() AS DATE))), @u
     FROM residentes r WHERE r.id = @r`,
    { r: Number(b.residente_id), concepto: v.limpio(b.concepto), base: Number(b.monto_base),
      desc: v.vacio(b.descuento_pct) ? 0 : Number(b.descuento_pct), venc: v.limpio(b.fecha_vencimiento), u: req.usuario.id }
  );
  if (!f) return res.status(404).json({ mensaje: 'El interno no existe.' });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'cargos', registroId: f.id, ip: req.ip });
  return res.status(201).json(f);
}));

// POST /api/caja/pagos  { cargo_id, monto, metodo, familiar_id?, observaciones?, clave_operacion }
router.post('/pagos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.cargo_id, 'El cargo'),
    v.monto(b.monto, 'El monto del pago'),
    v.opcion(b.metodo, 'El método de pago', METODOS),
    v.vacio(b.familiar_id) ? null : v.id(b.familiar_id, 'El familiar'),
    v.texto(b.observaciones, 'Las observaciones', { max: 300 }),
  );
  if (v.responderErrores(res, errores)) return;
  const clave = claveOperacion(b.clave_operacion);

  const resultado = await transaccion(async (q) => {
    const [repetido] = await q('SELECT id, numero_recibo FROM pagos WHERE clave_operacion = @clave', { clave });
    if (repetido) return { ...repetido, repetido: true };

    const [c] = await q(
      `SELECT c.id, c.residente_id, c.familiar_id, c.monto, c.estado,
              ISNULL((SELECT SUM(monto) FROM pagos WHERE cargo_id = c.id), 0) AS pagado
       FROM cargos c WITH (UPDLOCK) WHERE c.id = @id`, { id: Number(b.cargo_id) }
    );
    if (!c) throw fallo(404, 'El cargo no existe.');
    const saldo = Number((c.monto - c.pagado).toFixed(2));
    if (saldo <= 0) throw fallo(409, 'Este cargo ya está cancelado.');
    if (Number(b.monto) > saldo) throw fallo(400, `El pago (Q${Number(b.monto).toFixed(2)}) es mayor que el saldo del cargo (Q${saldo.toFixed(2)}).`);

    const recibo = await siguienteNumero(q, 'pagos', 'REC');
    const [p] = await q(
      `INSERT INTO pagos (cargo_id, residente_id, familiar_id, monto, metodo, numero_recibo, clave_operacion, observaciones, registrado_por)
       OUTPUT INSERTED.id, INSERTED.numero_recibo
       VALUES (@cargo, @r, @f, @monto, @metodo, @recibo, @clave, @obs, @u)`,
      { cargo: c.id, r: c.residente_id, f: v.vacio(b.familiar_id) ? c.familiar_id : Number(b.familiar_id),
        monto: Number(b.monto), metodo: b.metodo, recibo, clave, obs: v.limpio(b.observaciones), u: req.usuario.id }
    );
    const nuevoEstado = Number(b.monto) >= saldo ? 'Cancelado' : 'Parcial';
    await q('UPDATE cargos SET estado = @e WHERE id = @id', { id: c.id, e: nuevoEstado });
    return { ...p, estado_cargo: nuevoEstado };
  });

  if (!resultado.repetido) {
    await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'PAGO', tabla: 'pagos', registroId: resultado.id, detalle: resultado.numero_recibo, ip: req.ip });
  }
  res.status(resultado.repetido ? 200 : 201).json(resultado);
}));

// GET /api/caja/estado-cuenta/:residenteId
router.get('/estado-cuenta/:residenteId', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  await actualizarVencidos();
  const r = req.ids.residenteId;
  const [resumen] = await consultar('SELECT * FROM v_estado_cuenta WHERE residente_id = @r', { r });
  if (!resumen) return res.status(404).json({ mensaje: 'El interno no existe.' });
  const pagos = await consultar(
    `SELECT p.id, p.numero_recibo, p.fecha, p.monto, p.metodo, c.concepto, f.nombres + N' ' + f.apellidos AS familiar
     FROM pagos p JOIN cargos c ON c.id = p.cargo_id LEFT JOIN familiares f ON f.id = p.familiar_id
     WHERE p.residente_id = @r ORDER BY p.fecha DESC, p.id DESC`, { r }
  );
  const [cuota] = await consultar('SELECT monto_mensual, vigente_desde FROM cuotas WHERE residente_id = @r AND activa = 1', { r });
  return res.json({ ...resumen, pagos, cuota: cuota || null });
}));

/* =========================== CUOTAS =========================== */

// PUT /api/caja/cuotas/:residenteId  { monto_mensual, vigente_desde }
router.put('/cuotas/:residenteId', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(v.monto(b.monto_mensual, 'La cuota mensual'), v.fecha(b.vigente_desde, 'La fecha de vigencia'));
  if (v.responderErrores(res, errores)) return;
  const r = req.ids.residenteId;
  await transaccion(async (q) => {
    const [existe] = await q('SELECT id FROM residentes WHERE id = @r', { r });
    if (!existe) throw fallo(404, 'El interno no existe.');
    await q('UPDATE cuotas SET activa = 0 WHERE residente_id = @r AND activa = 1', { r });
    await q('INSERT INTO cuotas (residente_id, monto_mensual, vigente_desde) VALUES (@r, @m, @d)',
      { r, m: Number(b.monto_mensual), d: b.vigente_desde });
  });
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'EDITAR', tabla: 'cuotas', registroId: r, ip: req.ip });
  res.json({ residente_id: r, monto_mensual: Number(b.monto_mensual) });
}));

// POST /api/caja/cuotas/generar  { periodo: '2026-10' } : crea el cargo de cuota del mes a cada interno activo
router.post('/cuotas/generar', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const periodo = req.body && req.body.periodo;
  if (typeof periodo !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
    return res.status(400).json({ mensaje: 'El periodo debe tener el formato AAAA-MM.' });
  }
  const creados = await consultar(
    `INSERT INTO cargos (residente_id, familiar_id, tipo, concepto, monto_base, periodo, fecha_vencimiento, creado_por)
     OUTPUT INSERTED.id
     SELECT r.id, (SELECT familiar_id FROM residente_familiar WHERE residente_id = r.id AND es_responsable = 1),
            'Cuota', N'Cuota mensual ' + @periodo, cu.monto_mensual, @periodo,
            EOMONTH(CAST(@periodo + '-01' AS DATE)), @u
     FROM residentes r JOIN cuotas cu ON cu.residente_id = r.id AND cu.activa = 1
     WHERE r.estado = 'Activo' AND cu.vigente_desde <= EOMONTH(CAST(@periodo + '-01' AS DATE))
       AND NOT EXISTS (SELECT 1 FROM cargos c WHERE c.residente_id = r.id AND c.tipo = 'Cuota' AND c.periodo = @periodo)`,
    { periodo, u: req.usuario.id }
  );
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'GENERAR_CUOTAS', tabla: 'cargos', detalle: `${periodo}: ${creados.length}`, ip: req.ip });
  return res.status(201).json({ periodo, creados: creados.length });
}));

/* =========================== DONACIONES Y GASTOS =========================== */

router.get('/donaciones', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const { desde, hasta } = rangoFechas(req.query);
  res.json(await consultar(
    `SELECT TOP 500 id, tipo_donante, donante, monto, fecha, descripcion, numero_recibo FROM donaciones
     WHERE (@desde IS NULL OR fecha >= @desde) AND (@hasta IS NULL OR fecha <= @hasta) ORDER BY fecha DESC, id DESC`,
    { desde, hasta }
  ));
}));

router.post('/donaciones', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.opcion(b.tipo_donante, 'El tipo de donante', TIPOS_DONANTE),
    v.texto(b.donante, 'El donante', { obligatorio: true, max: 150 }),
    v.monto(b.monto, 'El monto de la donación', { maximo: 100000000 }),
    v.fecha(b.fecha, 'La fecha', { obligatorio: false }),
    v.texto(b.descripcion, 'La descripción', { max: 300 }),
  );
  if (!errores.length && b.fecha && new Date(`${b.fecha}T00:00:00`) > new Date()) errores.push('La fecha no puede ser futura.');
  if (v.responderErrores(res, errores)) return;
  const clave = claveOperacion(b.clave_operacion);
  const r = await transaccion(async (q) => {
    const [rep] = await q('SELECT id, numero_recibo FROM donaciones WHERE clave_operacion = @clave', { clave });
    if (rep) return { ...rep, repetido: true };
    const recibo = await siguienteNumero(q, 'donaciones', 'DON');
    const [d] = await q(
      `INSERT INTO donaciones (tipo_donante, donante, monto, fecha, descripcion, numero_recibo, clave_operacion, registrado_por)
       OUTPUT INSERTED.id, INSERTED.numero_recibo
       VALUES (@tipo, @donante, @monto, COALESCE(TRY_CAST(@fecha AS DATE), CAST(SYSDATETIME() AS DATE)), @desc, @recibo, @clave, @u)`,
      { tipo: b.tipo_donante, donante: v.limpio(b.donante), monto: Number(b.monto), fecha: v.limpio(b.fecha),
        desc: v.limpio(b.descripcion), recibo, clave, u: req.usuario.id }
    );
    return d;
  });
  if (!r.repetido) await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'donaciones', registroId: r.id, ip: req.ip });
  res.status(r.repetido ? 200 : 201).json(r);
}));

router.get('/gastos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const { desde, hasta } = rangoFechas(req.query);
  res.json(await consultar(
    `SELECT TOP 500 id, categoria, descripcion, monto, fecha, comprobante FROM gastos
     WHERE (@desde IS NULL OR fecha >= @desde) AND (@hasta IS NULL OR fecha <= @hasta) ORDER BY fecha DESC, id DESC`,
    { desde, hasta }
  ));
}));

router.post('/gastos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.opcion(b.categoria, 'La categoría', CATEGORIAS_GASTO),
    v.texto(b.descripcion, 'La descripción', { obligatorio: true, max: 300 }),
    v.monto(b.monto, 'El monto del gasto', { maximo: 100000000 }),
    v.fecha(b.fecha, 'La fecha', { obligatorio: false }),
    v.texto(b.comprobante, 'El comprobante', { max: 30 }),
  );
  if (!errores.length && b.fecha && new Date(`${b.fecha}T00:00:00`) > new Date()) errores.push('La fecha no puede ser futura.');
  if (v.responderErrores(res, errores)) return;
  const clave = claveOperacion(b.clave_operacion);
  const [rep] = await consultar('SELECT id FROM gastos WHERE clave_operacion = @clave', { clave });
  if (rep) return res.json({ ...rep, repetido: true });
  const [g] = await consultar(
    `INSERT INTO gastos (categoria, descripcion, monto, fecha, comprobante, clave_operacion, registrado_por) OUTPUT INSERTED.id
     VALUES (@cat, @desc, @monto, COALESCE(TRY_CAST(@fecha AS DATE), CAST(SYSDATETIME() AS DATE)), @comp, @clave, @u)`,
    { cat: b.categoria, desc: v.limpio(b.descripcion), monto: Number(b.monto), fecha: v.limpio(b.fecha),
      comp: v.limpio(b.comprobante), clave, u: req.usuario.id }
  );
  await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'CREAR', tabla: 'gastos', registroId: g.id, ip: req.ip });
  return res.status(201).json(g);
}));

/* =========================== FUNDACIÓN =========================== */

// GET /api/caja/fundacion?estado=Pendiente|Parcial|Cancelada : lo que se debe a la fundación por cita
router.get('/fundacion', permitirRoles(...PERMISOS.verDeudaFundacion), manejar(async (req, res) => {
  const estado = ['Pendiente', 'Parcial', 'Cancelada'].includes(req.query.estado) ? req.query.estado : null;
  const filas = await consultar(
    `SELECT d.*, r.codigo, r.nombres + N' ' + r.apellidos AS residente, e.nombre AS especialidad
     FROM v_deuda_fundacion_cita d JOIN residentes r ON r.id = d.residente_id
     JOIN citas_medicas c ON c.id = d.cita_id JOIN medicos m ON m.id = c.medico_id
     JOIN especialidades e ON e.id = m.especialidad_id
     WHERE (@estado IS NULL OR d.estado_pago = @estado) ORDER BY d.fecha_hora DESC`, { estado }
  );
  const total = filas.reduce((s, f) => s + Number(f.saldo), 0);
  res.json({ total_pendiente: Number(total.toFixed(2)), citas: filas });
}));

// POST /api/caja/fundacion/pagos  { cita_id, monto, comprobante, clave_operacion }
router.post('/fundacion/pagos', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const b = req.body || {};
  const errores = v.juntar(
    v.id(b.cita_id, 'La cita'), v.monto(b.monto, 'El monto'), v.texto(b.comprobante, 'El comprobante', { max: 30 }),
  );
  if (v.responderErrores(res, errores)) return;
  const clave = claveOperacion(b.clave_operacion);
  const r = await transaccion(async (q) => {
    const [rep] = await q('SELECT id FROM pagos_fundacion WHERE clave_operacion = @clave', { clave });
    if (rep) return { ...rep, repetido: true };
    await q('SELECT id FROM citas_medicas WITH (UPDLOCK) WHERE id = @id', { id: Number(b.cita_id) });
    const [d] = await q('SELECT saldo FROM v_deuda_fundacion_cita WHERE cita_id = @id', { id: Number(b.cita_id) });
    if (!d) throw fallo(404, 'La cita no existe o fue cancelada.');
    if (Number(d.saldo) <= 0) throw fallo(409, 'Esta cita ya está cancelada con la fundación.');
    if (Number(b.monto) > Number(d.saldo)) throw fallo(400, `El pago es mayor que lo que se debe por esta cita (Q${Number(d.saldo).toFixed(2)}).`);
    const [p] = await q(
      `INSERT INTO pagos_fundacion (cita_id, monto, comprobante, clave_operacion, registrado_por) OUTPUT INSERTED.id
       VALUES (@c, @m, @comp, @clave, @u)`,
      { c: Number(b.cita_id), m: Number(b.monto), comp: v.limpio(b.comprobante), clave, u: req.usuario.id }
    );
    return p;
  });
  if (!r.repetido) await registrarAuditoria({ usuarioId: req.usuario.id, accion: 'PAGO', tabla: 'pagos_fundacion', registroId: r.id, ip: req.ip });
  res.status(r.repetido ? 200 : 201).json(r);
}));

/* =========================== RESUMEN =========================== */

// GET /api/caja/resumen?desde=&hasta=  : entradas (donaciones y cobros) y salidas (gastos y pagos a la fundación)
router.get('/resumen', permitirRoles(...PERMISOS.caja), manejar(async (req, res) => {
  const { desde, hasta } = rangoFechas(req.query);
  const filtro = '(@desde IS NULL OR fecha >= @desde) AND (@hasta IS NULL OR fecha <= @hasta)';
  const [t] = await consultar(
    `SELECT (SELECT ISNULL(SUM(monto),0) FROM donaciones WHERE ${filtro}) AS donaciones,
            (SELECT ISNULL(SUM(monto),0) FROM pagos WHERE ${filtro}) AS cobros,
            (SELECT ISNULL(SUM(monto),0) FROM gastos WHERE ${filtro}) AS gastos,
            (SELECT ISNULL(SUM(monto),0) FROM pagos_fundacion WHERE ${filtro}) AS pagos_fundacion,
            (SELECT ISNULL(SUM(saldo),0) FROM v_deuda_fundacion_cita) AS deuda_fundacion,
            (SELECT ISNULL(SUM(saldo),0) FROM v_estado_cuenta WHERE saldo > 0) AS por_cobrar`,
    { desde, hasta }
  );
  const entradas = Number(t.donaciones) + Number(t.cobros);
  const salidas = Number(t.gastos) + Number(t.pagos_fundacion);
  res.json({ ...t, entradas, salidas, balance: Number((entradas - salidas).toFixed(2)), desde, hasta });
}));

module.exports = router;
module.exports.METODOS = METODOS;
module.exports.TIPOS_DONANTE = TIPOS_DONANTE;
module.exports.CATEGORIAS_GASTO = CATEGORIAS_GASTO;
