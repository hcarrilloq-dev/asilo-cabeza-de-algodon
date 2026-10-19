'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import Aviso from '@/components/Aviso';

const VACIO = { nombres: '', apellidos: '', dpi: '', telefono: '', email: '', direccion: '' };

export default function Familiares() {
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');
  const { datos: lista, error, recargar } = useDatos(`/familiares?buscar=${encodeURIComponent(consulta)}`);
  const [form, setForm] = useState(VACIO);
  const [mostrar, setMostrar] = useState(false);
  const { enviando, aviso, setAviso, enviar } = useEnvio();
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const ok = await enviar(() => api('/familiares', { metodo: 'POST', datos: form }),
      'Familiar registrado. Ahora puede vincularlo desde la ficha del interno.');
    if (ok) { setForm(VACIO); setMostrar(false); recargar(); }
  }

  return (
    <>
      <div className="encabezado">
        <div><h1>Familiares</h1><p>Familiares de los internos. El responsable de pagos recibe los cargos y los correos.</p></div>
        {!mostrar && <button className="boton" onClick={() => { setAviso(null); setMostrar(true); }}>Registrar familiar</button>}
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {mostrar && (
        <form className="formulario caja" onSubmit={guardar} noValidate style={{ marginBottom: '1.5rem' }}>
          <fieldset>
            <legend>Nuevo familiar</legend>
            <div className="campo"><label htmlFor="nombres">Nombres <span className="requerido">*</span></label><input id="nombres" name="nombres" value={form.nombres} onChange={cambiar} maxLength={80} /></div>
            <div className="campo"><label htmlFor="apellidos">Apellidos <span className="requerido">*</span></label><input id="apellidos" name="apellidos" value={form.apellidos} onChange={cambiar} maxLength={80} /></div>
            <div className="campo"><label htmlFor="dpi">DPI</label><input id="dpi" name="dpi" value={form.dpi} onChange={cambiar} inputMode="numeric" maxLength={13} /></div>
            <div className="campo"><label htmlFor="telefono">Teléfono <span className="requerido">*</span></label><input id="telefono" name="telefono" value={form.telefono} onChange={cambiar} inputMode="numeric" maxLength={8} /><small>8 dígitos</small></div>
            <div className="campo"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" value={form.email} onChange={cambiar} maxLength={120} /><small>Para avisarle de las solicitudes médicas</small></div>
            <div className="campo ancho"><label htmlFor="direccion">Dirección</label><input id="direccion" name="direccion" value={form.direccion} onChange={cambiar} maxLength={200} /></div>
          </fieldset>
          <div className="acciones">
            <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar familiar'}</button>
            <button className="boton secundario" type="button" onClick={() => setMostrar(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <form className="filtros" onSubmit={(e) => { e.preventDefault(); setConsulta(buscar.trim()); }}>
        <input type="search" placeholder="Buscar por nombre, DPI o teléfono" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar familiar" />
        <button className="boton secundario" type="submit">Buscar</button>
      </form>
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">No hay familiares registrados.</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>DPI</th><th>Teléfono</th><th>Correo</th><th>Internos</th></tr></thead>
              <tbody>{lista.map((f) => (
                <tr key={f.id}><td>{f.apellidos}, {f.nombres}</td><td>{f.dpi || '—'}</td><td>{f.telefono}</td><td>{f.email || '—'}</td><td>{f.internos}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
