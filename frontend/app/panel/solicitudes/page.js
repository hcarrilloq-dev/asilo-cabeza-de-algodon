'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';

const ESTADOS = ['Pendiente', 'Asignada', 'Atendida', 'Cancelada', ''];

function FormAsignar({ solicitud, medicos, precio, onListo, onCancelar }) {
  const [form, setForm] = useState({ medico_id: '', fecha_hora: '', lugar: '', precio: precio || '' });
  const { enviando, aviso, enviar } = useEnvio();
  const disponibles = medicos.filter((m) => m.tipo === 'Especialista' && m.especialidad_id === solicitud.especialidad_id);
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const r = await enviar(() => api(`/solicitudes/${solicitud.id}/asignar`, {
      metodo: 'POST', datos: { ...form, medico_id: Number(form.medico_id) || null },
    }));
    if (r) onListo(r);
  }

  return (
    <form className="fila-form" onSubmit={guardar} noValidate style={{ marginTop: '.75rem' }}>
      <div className="campo" style={{ gridColumn: '1 / -1' }}><Aviso aviso={aviso} /></div>
      <div className="campo">
        <label htmlFor={`med-${solicitud.id}`}>Médico ({solicitud.especialidad})</label>
        <select id={`med-${solicitud.id}`} name="medico_id" value={form.medico_id} onChange={cambiar}>
          <option value="">Seleccione…</option>
          {disponibles.map((m) => <option key={m.id} value={m.id}>{m.nombres} {m.apellidos}</option>)}
        </select>
      </div>
      <div className="campo"><label htmlFor={`fh-${solicitud.id}`}>Fecha y hora</label><input id={`fh-${solicitud.id}`} type="datetime-local" name="fecha_hora" value={form.fecha_hora} onChange={cambiar} /></div>
      <div className="campo"><label htmlFor={`lu-${solicitud.id}`}>Lugar</label><input id={`lu-${solicitud.id}`} name="lugar" value={form.lugar} onChange={cambiar} maxLength={150} /></div>
      <div className="campo"><label htmlFor={`pr-${solicitud.id}`}>Precio normal (Q)</label><input id={`pr-${solicitud.id}`} name="precio" value={form.precio} onChange={cambiar} inputMode="decimal" /></div>
      <div className="acciones">
        <button className="boton" type="submit" disabled={enviando}>Asignar cita</button>
        <button className="boton secundario" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export default function Solicitudes() {
  const [rol, setRol] = useState(null);
  const [estado, setEstado] = useState('Pendiente');
  const { datos: lista, error, recargar } = useDatos(`/solicitudes${estado ? `?estado=${estado}` : ''}`);
  const { datos: catalogos } = useDatos(rol === 'Fundacion' ? '/catalogos' : null);
  const [asignando, setAsignando] = useState(null);
  const { aviso, setAviso, enviar } = useEnvio();

  useEffect(() => { const s = leerSesion(); setRol(s ? s.usuario.rol : null); }, []);

  async function cancelar(s) {
    if (!window.confirm(`¿Cancelar la solicitud de ${s.residente} a ${s.especialidad}?`)) return;
    if (await enviar(() => api(`/solicitudes/${s.id}/cancelar`, { metodo: 'PATCH' }), 'Solicitud cancelada.')) recargar();
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Solicitudes a especialistas</h1>
          <p>{rol === 'Fundacion' ? 'Asigne el médico y el horario de cada solicitud del asilo.' : 'Referencias del médico general a los especialistas de la fundación.'}</p>
        </div>
        {rol === 'MedicoGeneral' && <Link className="boton" href="/panel/solicitudes/nueva">Nueva solicitud</Link>}
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="pestanas" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => <button key={e || 'todas'} aria-pressed={estado === e} onClick={() => setEstado(e)}>{e || 'Todas'}</button>)}
      </div>
      {error && <div className="mensaje error">{error}</div>}
      {!lista && !error && <p className="cargando">Cargando…</p>}
      {lista && lista.length === 0 && <div className="caja vacio">No hay solicitudes {estado ? estado.toLowerCase() + 's' : ''}.</div>}
      <div className="tarjetas">
        {(lista || []).map((s) => (
          <article key={s.id} className="tarjeta">
            <h3>{s.residente} · {s.especialidad} <Estado valor={s.estado} /> {s.prioridad === 'Urgente' && <Estado valor="Urgente" />}</h3>
            <p className="meta">{s.codigo} · {s.edad} años · Solicitada el {fechaHora(s.fecha_solicitud)} por Dr(a). {s.medico_general} · Acompaña: {s.enfermero}</p>
            <p style={{ margin: 0 }}><strong>Motivo:</strong> {s.motivo}</p>
            {s.cita_id && <p style={{ margin: '.5rem 0 0' }}><strong>Cita:</strong> {fechaHora(s.fecha_hora)} con Dr(a). {s.medico_asignado}{s.lugar ? ` en ${s.lugar}` : ''}</p>}
            {rol === 'Fundacion' && s.estado === 'Pendiente' && catalogos && (
              asignando === s.id ? (
                <FormAsignar solicitud={s} medicos={catalogos.medicos} precio={catalogos.configuracion.precio_consulta}
                  onCancelar={() => setAsignando(null)}
                  onListo={(r) => { setAsignando(null); setAviso({ tipo: 'exito', texto: `Cita asignada.${r.correo === 'Enviada' ? ' Se avisó al familiar por correo.' : ''}` }); recargar(); }} />
              ) : <div className="acciones"><button className="boton" onClick={() => setAsignando(s.id)}>Asignar médico y horario</button></div>
            )}
            {['MedicoGeneral', 'Administrador'].includes(rol) && s.estado === 'Pendiente' && (
              <div className="acciones"><button className="boton chico peligro" onClick={() => cancelar(s)}>Cancelar solicitud</button></div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
