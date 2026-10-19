'use client';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Aviso from '@/components/Aviso';

export default function Enfermeria() {
  const { datos: lista, error, recargar } = useDatos('/enfermeria/medicamentos');
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  async function aplicar(m) {
    const observaciones = window.prompt(`Aplicación de ${m.medicamento} a ${m.residente}.\nObservaciones (opcional):`, '');
    if (observaciones === null) return;
    if (await enviar(() => api(`/enfermeria/medicamentos/${m.id}/aplicar`, { metodo: 'POST', datos: { observaciones } }),
      'Aplicación registrada.')) recargar();
  }

  return (
    <>
      <div className="encabezado"><div><h1>Medicamentos a aplicar</h1><p>Medicamentos entregados por farmacia a los internos activos.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">No hay medicamentos por aplicar.</div> : (
            <table>
              <thead><tr><th>Interno</th><th>Habitación</th><th>Medicamento</th><th>Cómo aplicarlo</th><th>Aplicaciones</th><th>Última</th><th /></tr></thead>
              <tbody>{lista.map((m) => (
                <tr key={m.id}>
                  <td>{m.residente}</td><td>{m.habitacion || '—'}</td><td>{m.medicamento}</td>
                  <td className="ajustar">{m.dosis}, {m.frecuencia}, durante {m.tiempo_aplicacion}{m.indicaciones ? `. ${m.indicaciones}` : ''}</td>
                  <td>{m.aplicaciones}</td><td>{fechaHora(m.ultima_aplicacion)}</td>
                  <td><button className="boton chico" disabled={enviando} onClick={() => aplicar(m)}>Registrar aplicación</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
