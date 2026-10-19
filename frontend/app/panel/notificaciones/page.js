'use client';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';

export default function Notificaciones() {
  const { datos: lista, error, recargar } = useDatos('/notificaciones');
  const { enviando, aviso, setAviso, enviar } = useEnvio();
  const pendientes = (lista || []).filter((n) => n.estado === 'Pendiente').length;

  async function reenviar() {
    const r = await enviar(() => api('/notificaciones/reenviar', { metodo: 'POST' }),
      (x) => `Se revisaron ${x.revisadas} correos pendientes; se enviaron ${x.enviadas}.`);
    if (r) recargar();
  }

  return (
    <>
      <div className="encabezado">
        <div><h1>Correos a familiares</h1><p>Avisos enviados al familiar responsable cuando se crea una solicitud o se asigna una cita. Los pendientes se reintentan cada 5 minutos.</p></div>
        <button className="boton" onClick={reenviar} disabled={enviando || !pendientes}>Reintentar pendientes ({pendientes})</button>
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      {error && <div className="mensaje error">{error}</div>}
      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? <div className="vacio">Aún no se han generado correos.</div> : (
            <table>
              <thead><tr><th>Creado</th><th>Para</th><th>Interno</th><th>Asunto</th><th>Estado</th><th>Intentos</th><th>Último error</th></tr></thead>
              <tbody>{lista.map((n) => (
                <tr key={n.id}><td>{fechaHora(n.creada_en)}</td><td>{n.email}</td><td>{n.residente}</td><td className="ajustar">{n.asunto}</td>
                  <td><Estado valor={n.estado} /></td><td>{n.intentos}</td><td className="ajustar">{n.ultimo_error || '—'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
