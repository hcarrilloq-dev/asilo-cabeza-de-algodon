'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import Confirmar from '@/components/Confirmar';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Aviso from '@/components/Aviso';

export default function Enfermeria() {
  const { datos: lista, error, recargar } = useDatos('/enfermeria/medicamentos');
  const { enviando, aviso, setAviso, enviar } = useEnvio();
  const [actual, setActual] = useState(null);

  async function aplicar(m, observaciones) {
    setActual(null);
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
                  <td><button className="boton chico" disabled={enviando} onClick={() => setActual(m)}>Registrar aplicación</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <Confirmar abierto={!!actual} titulo="Registrar aplicación"
        mensaje={actual ? `${actual.medicamento} a ${actual.residente}: ${actual.dosis}, ${actual.frecuencia}.` : ''}
        textoConfirmar="Registrar" estiloConfirmar="" pedirMotivo motivoObligatorio={false} etiquetaMotivo="Observaciones (opcional)"
        onConfirmar={(obs) => aplicar(actual, obs)} onCancelar={() => setActual(null)} />
    </>
  );
}
