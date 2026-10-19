'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { dinero, fecha, hoyISO, nuevaClave } from '@/lib/formato';
import Aviso from './Aviso';

/** Formulario + lista para donaciones y gastos (misma estructura). */
export default function RegistroCaja({ ruta, campos, columnas, inicial, textoBoton, textoExito }) {
  const { datos: lista, error, recargar } = useDatos(ruta);
  const [form, setForm] = useState({ ...inicial, fecha: hoyISO() });
  const [clave, setClave] = useState(nuevaClave);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(ruta, { metodo: 'POST', datos: { ...form, clave_operacion: clave } }), textoExito);
    if (r) { setForm({ ...inicial, fecha: hoyISO() }); setClave(nuevaClave()); recargar(); }
  }

  const total = (lista || []).reduce((s, x) => s + Number(x.monto), 0);

  return (
    <>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <form className="fila-form caja" onSubmit={guardar} noValidate style={{ marginBottom: '1.5rem' }}>
        {campos.map((c) => (
          <div className="campo" key={c.nombre}>
            <label htmlFor={c.nombre}>{c.etiqueta}</label>
            {c.opciones ? (
              <select id={c.nombre} value={form[c.nombre]} onChange={(e) => setForm({ ...form, [c.nombre]: e.target.value })}>
                <option value="">Seleccione…</option>
                {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={c.nombre} type={c.tipo || 'text'} inputMode={c.inputMode} maxLength={c.max} max={c.tipo === 'date' ? hoyISO() : undefined}
                value={form[c.nombre]} onChange={(e) => setForm({ ...form, [c.nombre]: e.target.value })} />
            )}
          </div>
        ))}
        <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : textoBoton}</button>
      </form>
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">Aún no hay registros.</div> : (
            <table>
              <thead><tr>{columnas.map(([k, t]) => <th key={k} className={k === 'monto' ? 'numero' : ''}>{t}</th>)}</tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.id}>{columnas.map(([k]) => (
                    <td key={k} className={k === 'monto' ? 'numero' : k === 'descripcion' ? 'ajustar' : ''}>
                      {k === 'monto' ? dinero(x[k]) : k === 'fecha' ? fecha(x[k]) : (x[k] || '—')}
                    </td>
                  ))}</tr>
                ))}
                <tr><td colSpan={columnas.length - 1} className="total">Total</td><td className="numero total">{dinero(total)}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
