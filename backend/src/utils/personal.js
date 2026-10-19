/** Busca el registro de médico, enfermero o familiar vinculado al usuario con sesión. */
async function idVinculado(q, tabla, usuarioId) {
  const tablas = { medicos: 'medicos', enfermeros: 'enfermeros', familiares: 'familiares' };
  const filas = await q(`SELECT id FROM ${tablas[tabla]} WHERE usuario_id = @u`, { u: usuarioId });
  return filas[0] ? filas[0].id : null;
}

/**
 * Crea un cargo a la cuenta del familiar responsable del interno, con el descuento de la fundación.
 * Se usa dentro de una transacción (q).
 */
async function crearCargo(q, { residenteId, tipo, concepto, montoBase, descuento, citaId = null, examenId = null, vmId = null, usuarioId }) {
  if (!(Number(montoBase) > 0)) return null;
  const [resp] = await q(
    'SELECT familiar_id FROM residente_familiar WHERE residente_id = @r AND es_responsable = 1', { r: residenteId }
  );
  const [cargo] = await q(
    `INSERT INTO cargos (residente_id, familiar_id, tipo, concepto, monto_base, descuento_pct, cita_id, examen_id,
                         visita_medicamento_id, fecha_vencimiento, creado_por)
     OUTPUT INSERTED.id, INSERTED.monto
     VALUES (@r, @f, @tipo, @concepto, @base, @desc, @cita, @examen, @vm, DATEADD(DAY, 30, CAST(SYSDATETIME() AS DATE)), @u)`,
    { r: residenteId, f: resp ? resp.familiar_id : null, tipo, concepto: concepto.slice(0, 200), base: Number(montoBase),
      desc: Number(descuento) || 0, cita: citaId, examen: examenId, vm: vmId, u: usuarioId }
  );
  return cargo;
}

async function descuentos(q) {
  const filas = await q('SELECT clave, valor FROM configuracion');
  const c = Object.fromEntries(filas.map((f) => [f.clave, Number(f.valor)]));
  return {
    consulta: c.descuento_consulta || 0,
    laboratorio: c.descuento_laboratorio || 0,
    farmacia: c.descuento_farmacia || 0,
    precioConsulta: c.precio_consulta || 0,
  };
}

module.exports = { idVinculado, crearCargo, descuentos };
