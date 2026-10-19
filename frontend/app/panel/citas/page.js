'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';

export default function Citas() {
  const router = useRouter();
  const [rol, setRol] = useState(null);
  const [estado, setEstado] = useState('Programada');
  const { datos: lista, error } = useDatos(`/citas${estado ? `?estado=${estado}` : ''}`);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  useEffect(() => { const s = leerSesion(); setRol(s ? s.usuario.rol : null); }, []);

  async function atender(c) {
    const r = await enviar(() => api(`/citas/${c.id}/visita`, { metodo: 'POST' }));
    if (r) router.push(`/panel/visitas/${r.id}`);
  }

  const titulo = rol === 'MedicoEspecialista' ? 'Mis citas' : rol === 'Enfermeria' ? 'Citas que acompaño' : 'Citas médicas';

  return (
    <>
      <div className="encabezado"><div><h1>{titulo}</h1><p>Citas asignadas por la fundación.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="pestanas" role="group" aria-label="Filtrar por estado">
        {['Programada', 'Realizada', ''].map((e) => <button key={e || 't'} aria-pressed={estado === e} onClick={() => setEstado(e)}>{e ? `${e}s` : 'Todas'}</button>)}
      </div>
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">No hay citas en esta lista.</div> : (
            <table>
              <thead><tr><th>Fecha y hora</th><th>Interno</th><th>Especialidad</th><th>Médico</th><th>Enfermero(a)</th><th>Lugar</th><th>Estado</th><th /></tr></thead>
              <tbody>{lista.map((c) => (
                <tr key={c.id}>
                  <td>{fechaHora(c.fecha_hora)}</td><td>{c.residente} <span className="texto-suave">({c.codigo})</span></td>
                  <td>{c.especialidad}</td><td>{c.medico}</td><td>{c.enfermero}</td><td>{c.lugar || '—'}</td>
                  <td><Estado valor={c.estado} /></td>
                  <td>
                    {rol === 'MedicoEspecialista' && c.estado === 'Programada' && !c.visita_id && (
                      <button className="boton chico" disabled={enviando} onClick={() => atender(c)}>Atender</button>
                    )}
                    {c.visita_id && rol !== 'Fundacion' && <Link href={`/panel/visitas/${c.visita_id}`}>Ver visita</Link>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
