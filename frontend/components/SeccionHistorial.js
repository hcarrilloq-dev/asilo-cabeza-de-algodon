'use client';
import Link from 'next/link';
import { useDatos } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Estado from './Estado';

export default function SeccionHistorial({ residenteId }) {
  const { datos, error } = useDatos(`/residentes/${residenteId}/historial`);
  return (
    <section className="seccion">
      <h2>Historial médico</h2>
      {error && <div className="mensaje error">{error}</div>}
      {!datos && !error && <p className="cargando">Cargando…</p>}
      {datos && (
        datos.visitas.length === 0 && datos.solicitudes.length === 0 ? (
          <p className="texto-suave">Aún no hay solicitudes ni visitas médicas.</p>
        ) : (
          <>
            {datos.visitas.length > 0 && (
              <div className="tabla-envoltura" style={{ marginBottom: '1rem' }}>
                <table>
                  <thead><tr><th>Fecha de visita</th><th>Especialidad</th><th>Médico tratante</th><th>Motivo</th><th>Diagnóstico</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {datos.visitas.map((vi) => (
                      <tr key={vi.id}>
                        <td>{fechaHora(vi.fecha_visita)}</td><td>{vi.especialidad}</td><td>{vi.medico}</td>
                        <td className="ajustar">{vi.motivo}</td><td className="ajustar">{vi.diagnostico || '—'}</td>
                        <td><Estado valor={vi.estado} /></td>
                        <td><Link href={`/panel/visitas/${vi.id}`}>Ver visita</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="tabla-envoltura">
              <table>
                <thead><tr><th>Solicitud</th><th>Especialidad</th><th>Prioridad</th><th>Motivo</th><th>Estado</th></tr></thead>
                <tbody>
                  {datos.solicitudes.map((s) => (
                    <tr key={s.id}>
                      <td>{fechaHora(s.fecha_solicitud)}</td><td>{s.especialidad}</td><td><Estado valor={s.prioridad} /></td>
                      <td className="ajustar">{s.motivo}</td><td><Estado valor={s.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </section>
  );
}
