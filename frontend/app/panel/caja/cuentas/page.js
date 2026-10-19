'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { dinero, fecha, hoyISO, nuevaClave } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';
import MenuCaja from '@/components/MenuCaja';

function FormPago({ cargo, onListo, onCancelar }) {
  const [form, setForm] = useState({ monto: String(cargo.saldo), metodo: 'Efectivo', observaciones: '' });
  const [clave] = useState(nuevaClave);
  const { enviando, aviso, enviar } = useEnvio();
  async function pagar(e) {
    e.preventDefault();
    const r = await enviar(() => api('/caja/pagos', { metodo: 'POST', datos: { ...form, cargo_id: cargo.id, clave_operacion: clave } }));
    if (r) onListo(r);
  }
  return (
    <tr><td colSpan={9}>
      <form className="fila-form" onSubmit={pagar} noValidate>
        <div className="campo" style={{ gridColumn: '1 / -1' }}><Aviso aviso={aviso} /></div>
        <div className="campo"><label htmlFor={`m-${cargo.id}`}>Monto (saldo {dinero(cargo.saldo)})</label><input id={`m-${cargo.id}`} inputMode="decimal" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
        <div className="campo"><label htmlFor={`me-${cargo.id}`}>Método</label>
          <select id={`me-${cargo.id}`} value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
            {['Efectivo', 'Transferencia', 'Deposito', 'Tarjeta'].map((m) => <option key={m} value={m}>{m === 'Deposito' ? 'Depósito' : m}</option>)}
          </select></div>
        <div className="campo"><label htmlFor={`o-${cargo.id}`}>Observaciones</label><input id={`o-${cargo.id}`} maxLength={300} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
        <div className="acciones">
          <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar pago'}</button>
          <button className="boton secundario" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </td></tr>
  );
}

export default function Cuentas() {
  const { datos: residentes } = useDatos('/residentes?estado=');
  const [residenteId, setResidenteId] = useState('');
  const { datos: cuenta, recargar: recargarCuenta } = useDatos(residenteId ? `/caja/estado-cuenta/${residenteId}` : null);
  const { datos: cargos, recargar: recargarCargos } = useDatos(`/caja/cargos${residenteId ? `?residente_id=${residenteId}` : '?estado=ConSaldo'}`);
  const [pagando, setPagando] = useState(null);
  const [cargo, setCargo] = useState({ concepto: '', monto_base: '', descuento_pct: '0', fecha_vencimiento: '' });
  const [cuota, setCuota] = useState({ monto_mensual: '', vigente_desde: hoyISO() });
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('residente');
    if (r) setResidenteId(r);
  }, []);

  const recargar = () => { recargarCargos(); recargarCuenta(); };

  async function crearCargo(e) {
    e.preventDefault();
    if (await enviar(() => api('/caja/cargos', { metodo: 'POST', datos: { ...cargo, residente_id: Number(residenteId) } }), 'Cargo registrado.')) {
      setCargo({ concepto: '', monto_base: '', descuento_pct: '0', fecha_vencimiento: '' }); recargar();
    }
  }
  async function guardarCuota(e) {
    e.preventDefault();
    if (await enviar(() => api(`/caja/cuotas/${residenteId}`, { metodo: 'PUT', datos: cuota }), 'Cuota mensual actualizada.')) recargar();
  }

  return (
    <>
      <div className="encabezado"><div><h1>Cuentas y pagos</h1><p>Cargos a la cuenta del familiar responsable, con el descuento de la fundación.</p></div></div>
      <MenuCaja />
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="filtros">
        <select value={residenteId} onChange={(e) => { setResidenteId(e.target.value); setPagando(null); }} aria-label="Interno" style={{ maxWidth: 420 }}>
          <option value="">Todos los cargos con saldo</option>
          {(residentes || []).map((r) => <option key={r.id} value={r.id}>{r.apellidos}, {r.nombres} ({r.codigo})</option>)}
        </select>
      </div>

      {cuenta && (
        <div className="resumen">
          <div className="dato"><b>{dinero(cuenta.total_cargos)}</b><span>Total cargado</span></div>
          <div className="dato"><b>{dinero(cuenta.total_pagos)}</b><span>Total pagado</span></div>
          <div className="dato"><b style={{ color: cuenta.saldo > 0 ? 'var(--peligro)' : undefined }}>{dinero(cuenta.saldo)}</b><span>Saldo pendiente</span></div>
          <div className="dato"><b>{cuenta.cuota ? dinero(cuenta.cuota.monto_mensual) : '—'}</b><span>Cuota mensual</span></div>
        </div>
      )}

      {cargos && (
        <div className="tabla-envoltura">
          {cargos.length === 0 ? <div className="vacio">No hay cargos.</div> : (
            <table>
              <thead><tr><th>Fecha</th>{!residenteId && <th>Interno</th>}<th>Concepto</th><th className="numero">Precio</th><th className="numero">Desc.</th><th className="numero">A pagar</th><th className="numero">Saldo</th><th>Estado</th><th /></tr></thead>
              <tbody>{cargos.map((c) => (
                <FilaCargo key={c.id} c={c} conInterno={!residenteId} pagando={pagando === c.id}
                  onPagar={() => { setAviso(null); setPagando(c.id); }}
                  onListo={(r) => { setPagando(null); setAviso({ tipo: 'exito', texto: r.repetido ? `Ese pago ya estaba registrado (recibo ${r.numero_recibo}).` : `Pago registrado. Recibo ${r.numero_recibo}.` }); recargar(); }}
                  onCancelar={() => setPagando(null)} />
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {residenteId && (
        <>
          <section className="seccion">
            <h2>Cuota mensual</h2>
            <form className="fila-form caja" onSubmit={guardarCuota} noValidate>
              <div className="campo"><label htmlFor="cuota">Monto mensual (Q)</label><input id="cuota" inputMode="decimal" value={cuota.monto_mensual} onChange={(e) => setCuota({ ...cuota, monto_mensual: e.target.value })} /></div>
              <div className="campo"><label htmlFor="vig">Vigente desde</label><input id="vig" type="date" value={cuota.vigente_desde} onChange={(e) => setCuota({ ...cuota, vigente_desde: e.target.value })} /></div>
              <button className="boton secundario" type="submit" disabled={enviando}>Guardar cuota</button>
            </form>
          </section>
          <section className="seccion">
            <h2>Otro cargo</h2>
            <form className="fila-form caja" onSubmit={crearCargo} noValidate>
              <div className="campo"><label htmlFor="conc">Concepto</label><input id="conc" maxLength={200} value={cargo.concepto} onChange={(e) => setCargo({ ...cargo, concepto: e.target.value })} placeholder="Pañales, terapia…" /></div>
              <div className="campo"><label htmlFor="mb">Monto (Q)</label><input id="mb" inputMode="decimal" value={cargo.monto_base} onChange={(e) => setCargo({ ...cargo, monto_base: e.target.value })} /></div>
              <div className="campo"><label htmlFor="dp">Descuento (%)</label><input id="dp" inputMode="decimal" value={cargo.descuento_pct} onChange={(e) => setCargo({ ...cargo, descuento_pct: e.target.value })} /></div>
              <div className="campo"><label htmlFor="fv">Vence</label><input id="fv" type="date" value={cargo.fecha_vencimiento} onChange={(e) => setCargo({ ...cargo, fecha_vencimiento: e.target.value })} /></div>
              <button className="boton secundario" type="submit" disabled={enviando}>Registrar cargo</button>
            </form>
          </section>
          {cuenta && cuenta.pagos.length > 0 && (
            <section className="seccion">
              <h2>Pagos recibidos</h2>
              <div className="tabla-envoltura"><table>
                <thead><tr><th>Recibo</th><th>Fecha</th><th>Concepto</th><th>Pagó</th><th>Método</th><th className="numero">Monto</th></tr></thead>
                <tbody>{cuenta.pagos.map((p) => (
                  <tr key={p.id}><td>{p.numero_recibo}</td><td>{fecha(p.fecha)}</td><td>{p.concepto}</td><td>{p.familiar || '—'}</td><td>{p.metodo}</td><td className="numero">{dinero(p.monto)}</td></tr>
                ))}</tbody>
              </table></div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function FilaCargo({ c, conInterno, pagando, onPagar, onListo, onCancelar }) {
  return (
    <>
      <tr>
        <td>{fecha(c.fecha)}</td>{conInterno && <td className="ajustar">{c.residente}</td>}
        <td className="ajustar">{c.concepto}{c.familiar ? <div className="texto-suave">Cuenta de {c.familiar}</div> : <div className="texto-suave">Sin familiar responsable</div>}</td>
        <td className="numero">{dinero(c.monto_base)}</td><td className="numero">{Number(c.descuento_pct)} %</td>
        <td className="numero">{dinero(c.monto)}</td><td className="numero total">{dinero(c.saldo)}</td>
        <td><Estado valor={c.estado} /></td>
        <td>{c.saldo > 0 && !pagando && <button className="boton chico" onClick={onPagar}>Pagar</button>}</td>
      </tr>
      {pagando && <FormPago cargo={c} onListo={onListo} onCancelar={onCancelar} />}
    </>
  );
}
