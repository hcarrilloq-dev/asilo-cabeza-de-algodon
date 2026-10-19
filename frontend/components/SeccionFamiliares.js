'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import Aviso from './Aviso';

export default function SeccionFamiliares({ residenteId, puedeEditar }) {
  const { datos: lista, recargar } = useDatos(`/residentes/${residenteId}/familiares`);
  const [buscar, setBuscar] = useState('');
  const [opciones, setOpciones] = useState([]);
  const [form, setForm] = useState({ familiar_id: '', parentesco: '', es_responsable: false });
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  async function buscarFamiliares(e) {
    e.preventDefault();
    try { setOpciones(await api(`/familiares?buscar=${encodeURIComponent(buscar)}`)); } catch (err) { setAviso({ tipo: 'error', texto: err.message }); }
  }

  async function vincular(e) {
    e.preventDefault();
    const ok = await enviar(() => api(`/residentes/${residenteId}/familiares`, {
      metodo: 'POST', datos: { ...form, familiar_id: Number(form.familiar_id) },
    }), 'Familiar vinculado.');
    if (ok) { setForm({ familiar_id: '', parentesco: '', es_responsable: false }); setOpciones([]); setBuscar(''); recargar(); }
  }

  async function quitar(f) {
    if (!window.confirm(`¿Quitar a ${f.nombres} ${f.apellidos} de los familiares de este interno?`)) return;
    const ok = await enviar(() => api(`/residentes/${residenteId}/familiares/${f.id}`, { metodo: 'DELETE' }), 'Familiar desvinculado.');
    if (ok) recargar();
  }

  return (
    <section className="seccion">
      <h2>Familiares</h2>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      {!lista ? <p className="cargando">Cargando…</p> : lista.length === 0 ? (
        <p className="texto-suave">Este interno no tiene familiares registrados. Los cargos se asignan al familiar responsable.</p>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead><tr><th>Nombre</th><th>Parentesco</th><th>Teléfono</th><th>Correo</th><th>Responsable de pagos</th>{puedeEditar && <th />}</tr></thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td>{f.nombres} {f.apellidos}</td><td>{f.parentesco}</td><td>{f.telefono}</td><td>{f.email || '—'}</td>
                  <td>{f.es_responsable ? <span className="etiqueta si">Sí</span> : 'No'}</td>
                  {puedeEditar && <td><button className="boton chico secundario" onClick={() => quitar(f)}>Quitar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeEditar && (
        <div className="caja" style={{ marginTop: '1rem' }}>
          <form className="fila-form" onSubmit={buscarFamiliares}>
            <div className="campo">
              <label htmlFor="buscar-fam">Buscar familiar registrado</label>
              <input id="buscar-fam" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre, DPI o teléfono" />
            </div>
            <button className="boton secundario" type="submit">Buscar</button>
          </form>
          <p className="texto-suave" style={{ margin: '.5rem 0 0' }}>¿No aparece? Regístrelo primero en el menú <a href="/panel/familiares">Familiares</a>.</p>
          {opciones.length > 0 && (
            <form className="fila-form" onSubmit={vincular} style={{ marginTop: '1rem' }}>
              <div className="campo">
                <label htmlFor="fam-sel">Familiar</label>
                <select id="fam-sel" value={form.familiar_id} onChange={(e) => setForm({ ...form, familiar_id: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombres} {o.apellidos} · {o.telefono}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="parentesco">Parentesco</label>
                <input id="parentesco" value={form.parentesco} maxLength={30} onChange={(e) => setForm({ ...form, parentesco: e.target.value })} placeholder="Hijo(a), sobrino(a)…" />
              </div>
              <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.es_responsable} onChange={(e) => setForm({ ...form, es_responsable: e.target.checked })} />
                Responsable de pagos
              </label>
              <button className="boton" type="submit" disabled={enviando}>Vincular</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
