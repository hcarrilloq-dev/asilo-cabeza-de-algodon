'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { dinero, hoyISO } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import MenuCaja from '@/components/MenuCaja';

const inicioMes = () => `${hoyISO().slice(0, 7)}-01`;

export default function Caja() {
  const [rango, setRango] = useState({ desde: inicioMes(), hasta: hoyISO() });
  const [consulta, setConsulta] = useState(rango);
  const { datos: r, error } = useDatos(`/caja/resumen?desde=${consulta.desde}&hasta=${consulta.hasta}`);
  const [periodo, setPeriodo] = useState(hoyISO().slice(0, 7));
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  async function generar(e) {
    e.preventDefault();
    await enviar(() => api('/caja/cuotas/generar', { metodo: 'POST', datos: { periodo } }),
      (res) => (res.creados ? `Se generaron ${res.creados} cargos de cuota para ${periodo}.` : `No había cuotas nuevas que generar para ${periodo}.`));
  }

  return (
    <>
      <div className="encabezado"><div><h1>Caja</h1><p>Entradas (donaciones y cobros) y salidas (gastos y pagos a la fundación).</p></div></div>
      <MenuCaja />
      <form className="filtros" onSubmit={(e) => { e.preventDefault(); setConsulta(rango); }}>
        <div className="campo"><label htmlFor="desde">Desde</label><input id="desde" type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} /></div>
        <div className="campo"><label htmlFor="hasta">Hasta</label><input id="hasta" type="date" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} /></div>
        <button className="boton secundario" type="submit" style={{ alignSelf: 'flex-end' }}>Consultar</button>
      </form>
      {error && <div className="mensaje error">{error}</div>}
      {r && (
        <>
          <div className="resumen">
            <div className="dato"><b>{dinero(r.donaciones)}</b><span>Donaciones</span></div>
            <div className="dato"><b>{dinero(r.cobros)}</b><span>Cobros a familiares</span></div>
            <div className="dato"><b>{dinero(r.gastos)}</b><span>Gastos del asilo</span></div>
            <div className="dato"><b>{dinero(r.pagos_fundacion)}</b><span>Pagos a la fundación</span></div>
          </div>
          <div className="resumen">
            <div className="dato"><b style={{ color: r.balance < 0 ? 'var(--peligro)' : undefined }}>{dinero(r.balance)}</b><span>Balance del periodo</span></div>
            <div className="dato"><b>{dinero(r.por_cobrar)}</b><span>Por cobrar a familiares (total)</span></div>
            <div className="dato"><b>{dinero(r.deuda_fundacion)}</b><span>Se debe a la fundación (total)</span></div>
          </div>
        </>
      )}
      <section className="seccion">
        <h2>Cuotas mensuales</h2>
        <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
        <form className="fila-form caja" onSubmit={generar}>
          <div className="campo"><label htmlFor="periodo">Mes</label><input id="periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></div>
          <button className="boton" type="submit" disabled={enviando}>Generar cargos de cuota del mes</button>
          <p className="texto-suave" style={{ margin: 0 }}>Crea el cargo a cada interno activo con cuota asignada. Si ya existe, no lo repite.</p>
        </form>
      </section>
    </>
  );
}
