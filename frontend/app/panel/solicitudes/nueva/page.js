'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import Aviso from '@/components/Aviso';

export default function NuevaSolicitud() {
  const { datos: catalogos } = useDatos('/catalogos');
  const { datos: residentes } = useDatos('/residentes?estado=Activo');
  const [form, setForm] = useState({ residente_id: '', especialidad_id: '', enfermero_id: '', prioridad: 'Normal', motivo: '' });
  const [creada, setCreada] = useState(null);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('residente');
    if (r) setForm((f) => ({ ...f, residente_id: r }));
  }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api('/solicitudes', {
      metodo: 'POST',
      datos: { ...form, residente_id: Number(form.residente_id) || null, especialidad_id: Number(form.especialidad_id) || null, enfermero_id: Number(form.enfermero_id) || null },
    }));
    if (r) setCreada(r);
  }

  if (creada) {
    const textoCorreo = creada.correo === 'Enviada' ? 'Se envió el correo al familiar responsable.'
      : creada.correo === 'Pendiente' ? 'El correo al familiar no se pudo enviar todavía; quedó pendiente y el sistema lo reintentará.'
        : creada.correo;
    return (
      <>
        <div className="encabezado"><div><h1>Solicitud creada</h1></div></div>
        <div className="mensaje exito">La solicitud quedó registrada y ya aparece en el módulo de la fundación para que asigne el médico y el horario.</div>
        <p>{textoCorreo}</p>
        <div className="acciones">
          <Link className="boton" href="/panel/solicitudes">Ver solicitudes</Link>
          <button className="boton secundario" onClick={() => { setCreada(null); setForm({ ...form, motivo: '' }); }}>Crear otra</button>
        </div>
      </>
    );
  }

  const especialidades = catalogos ? catalogos.especialidades.filter((e) => e.nombre !== 'Medicina general') : [];

  return (
    <>
      <div className="encabezado"><div><h1>Referir a especialista</h1><p>La solicitud se envía a la fundación y se avisa por correo al familiar responsable.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <form className="formulario caja" onSubmit={guardar} noValidate>
        <fieldset>
          <legend>Datos de la solicitud</legend>
          <div className="campo">
            <label htmlFor="residente_id">Interno <span className="requerido">*</span></label>
            <select id="residente_id" name="residente_id" value={form.residente_id} onChange={cambiar}>
              <option value="">Seleccione…</option>
              {(residentes || []).map((r) => <option key={r.id} value={r.id}>{r.apellidos}, {r.nombres} ({r.codigo})</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="especialidad_id">Especialidad <span className="requerido">*</span></label>
            <select id="especialidad_id" name="especialidad_id" value={form.especialidad_id} onChange={cambiar}>
              <option value="">Seleccione…</option>
              {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="enfermero_id">Enfermero(a) que acompaña <span className="requerido">*</span></label>
            <select id="enfermero_id" name="enfermero_id" value={form.enfermero_id} onChange={cambiar}>
              <option value="">Seleccione…</option>
              {(catalogos ? catalogos.enfermeros : []).map((e) => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos} · {e.turno}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="prioridad">Prioridad</label>
            <select id="prioridad" name="prioridad" value={form.prioridad} onChange={cambiar}>
              <option value="Normal">Normal</option><option value="Urgente">Urgente</option>
            </select>
          </div>
          <div className="campo ancho">
            <label htmlFor="motivo">Motivo de la referencia <span className="requerido">*</span></label>
            <textarea id="motivo" name="motivo" value={form.motivo} onChange={cambiar} maxLength={500} />
          </div>
        </fieldset>
        <div className="acciones">
          <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Crear solicitud'}</button>
          <Link className="boton secundario" href="/panel/solicitudes">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
