'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora, dinero } from '@/lib/formato';
import Aviso from '@/components/Aviso';

export default function Farmacia() {
  const [estado, setEstado] = useState('Indicado');
  const { datos: lista, error, recargar } = useDatos(`/farmacia/medicamentos?estado=${estado}`);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  async function entregar(m) {
    if (!window.confirm(`¿Confirmar la entrega de ${m.medicamento} x ${m.cantidad} para ${m.residente}?`)) return;
    if (await enviar(() => api(`/farmacia/medicamentos/${m.id}/entregar`, { metodo: 'POST' }),
      `Entregado. Se cargó ${dinero(m.monto)} a la cuenta del familiar.`)) recargar();
  }

  return (
    <>
      <div className="encabezado"><div><h1>Farmacia</h1><p>Medicamentos indicados por los médicos en las visitas de los internos del asilo.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="pestanas" role="group" aria-label="Filtrar">
        <button aria-pressed={estado === 'Indicado'} onClick={() => setEstado('Indicado')}>Por entregar</button>
        <button aria-pressed={estado === 'Entregado'} onClick={() => setEstado('Entregado')}>Entregados</button>
      </div>
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">No hay medicamentos en esta lista.</div> : (
            <table>
              <thead><tr><th>Interno</th><th>Medicamento</th><th>Cantidad</th><th>Cómo tomarlo</th><th>Médico</th><th className="numero">Precio con descuento</th><th /></tr></thead>
              <tbody>{lista.map((m) => (
                <tr key={m.id}>
                  <td>{m.residente} <span className="texto-suave">({m.codigo})</span></td><td>{m.medicamento}</td><td>{m.cantidad}</td>
                  <td className="ajustar">{m.dosis}, {m.frecuencia}, durante {m.tiempo_aplicacion}</td><td>{m.medico}</td>
                  <td className="numero">{dinero(m.monto)} <span className="texto-suave">(−{Number(m.descuento_pct)} %)</span></td>
                  <td>{estado === 'Indicado' ? <button className="boton chico" disabled={enviando} onClick={() => entregar(m)}>Entregar</button> : fechaHora(m.entregado_en)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
