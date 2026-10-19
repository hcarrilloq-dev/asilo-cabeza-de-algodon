'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora, dinero } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';
import Confirmar from '@/components/Confirmar';

const MED_VACIO = { medicamento_id: '', cantidad: '', dosis: '', frecuencia: '', tiempo_aplicacion: '', indicaciones: '' };

export default function Visita() {
  const { id } = useParams();
  const { datos: vis, error, recargar } = useDatos(`/visitas/${id}`);
  const [notas, setNotas] = useState({ diagnostico: '', observaciones: '' });
  const [examen, setExamen] = useState({ tipo_examen: '', indicaciones: '' });
  const [med, setMed] = useState(MED_VACIO);
  const [catalogo, setCatalogo] = useState([]);
  const [confirmar, setConfirmar] = useState(false);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  const editable = vis && vis.es_mi_visita && vis.estado === 'Abierta';

  useEffect(() => {
    if (vis) setNotas({ diagnostico: vis.diagnostico || '', observaciones: vis.observaciones || '' });
  }, [vis]);
  useEffect(() => {
    if (editable && !catalogo.length) api('/catalogos').then((c) => setCatalogo(c.medicamentos)).catch(() => {});
  }, [editable, catalogo.length]);

  async function guardarNotas() {
    if (await enviar(() => api(`/visitas/${id}`, { metodo: 'PUT', datos: notas }), 'Avance guardado.')) recargar();
  }
  async function cerrar() {
    setConfirmar(false);
    if (await enviar(() => api(`/visitas/${id}/cerrar`, { metodo: 'POST', datos: notas }), 'Visita cerrada. Ya forma parte del historial médico del interno.')) recargar();
  }
  async function agregarExamen(e) {
    e.preventDefault();
    if (await enviar(() => api(`/visitas/${id}/examenes`, { metodo: 'POST', datos: examen }), 'Examen asignado. El laboratorio ya lo puede ver.')) {
      setExamen({ tipo_examen: '', indicaciones: '' }); recargar();
    }
  }
  async function agregarMedicamento(e) {
    e.preventDefault();
    const datos = { ...med, medicamento_id: Number(med.medicamento_id) || null, cantidad: med.cantidad === '' ? null : Number(med.cantidad) };
    if (await enviar(() => api(`/visitas/${id}/medicamentos`, { metodo: 'POST', datos }), 'Medicamento indicado. La farmacia ya lo puede entregar.')) {
      setMed(MED_VACIO); recargar();
    }
  }

  if (error) return <div className="mensaje error">{error}</div>;
  if (!vis) return <p className="cargando">Cargando visita…</p>;
  const f = vis.ficha;

  return (
    <>
      <div className="encabezado">
        <div>
          <p>{f ? <Link href={`/panel/residentes/${vis.residente_id}`}>{vis.residente}</Link> : vis.residente} · {vis.codigo}</p>
          <h1>Visita médica <Estado valor={vis.estado} /></h1>
          <p>{fechaHora(vis.fecha_visita)} · Dr(a). {vis.medico} · {vis.especialidad}</p>
        </div>
      </div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <section className="caja">
        <dl className="detalle">
          <div className="ancho"><dt>Motivo de la referencia</dt><dd>{vis.motivo}</dd></div>
          {f && <>
            <div className="ancho sensible"><dt>Psicopatologías</dt><dd>{f.psicopatologias || 'No registradas'}</dd></div>
            <div><dt>Medicamentos de cajón</dt><dd>{f.medicamentos_cajon || 'No registrados'}</dd></div>
            <div><dt>Alergias</dt><dd>{f.alergias || 'No registradas'}</dd></div>
            <div><dt>Condiciones médicas</dt><dd>{f.condiciones_medicas || 'No registradas'}</dd></div>
            <div><dt>Tipo de sangre</dt><dd>{f.tipo_sangre || 'No registrado'}</dd></div>
          </>}
        </dl>
        {f && <p style={{ margin: '1rem 0 0' }}><Link href={`/panel/residentes/${vis.residente_id}`}>Ver ficha e historial médico completo</Link></p>}
      </section>

      {'diagnostico' in vis && (
        <section className="seccion">
          <h2>Diagnóstico y observaciones</h2>
          {editable ? (
            <div className="formulario caja">
              <div className="campo"><label htmlFor="diag">Diagnóstico</label><textarea id="diag" value={notas.diagnostico} maxLength={1000} onChange={(e) => setNotas({ ...notas, diagnostico: e.target.value })} /></div>
              <div className="campo"><label htmlFor="obs">Observaciones médicas</label><textarea id="obs" value={notas.observaciones} maxLength={1000} onChange={(e) => setNotas({ ...notas, observaciones: e.target.value })} /></div>
              <div className="acciones">
                <button className="boton secundario" onClick={guardarNotas} disabled={enviando}>Guardar avance</button>
                <button className="boton" onClick={() => setConfirmar(true)} disabled={enviando || !notas.diagnostico.trim()}>Cerrar visita</button>
              </div>
              {!notas.diagnostico.trim() && <small className="texto-suave">Escriba el diagnóstico para poder cerrar la visita.</small>}
            </div>
          ) : (
            <dl className="detalle caja">
              <div className="ancho"><dt>Diagnóstico</dt><dd>{vis.diagnostico || 'Pendiente'}</dd></div>
              <div className="ancho"><dt>Observaciones</dt><dd>{vis.observaciones || '—'}</dd></div>
            </dl>
          )}
        </section>
      )}

      {vis.examenes && (vis.examenes.length > 0 || editable) && (
        <section className="seccion">
          <h2>Exámenes de laboratorio</h2>
          {vis.examenes.length > 0 && (
            <div className="tabla-envoltura">
              <table>
                <thead><tr><th>Examen</th><th>Indicaciones</th><th>Estado</th><th>Resultado</th><th>Fecha</th><th className="numero">Costo</th></tr></thead>
                <tbody>{vis.examenes.map((x) => (
                  <tr key={x.id}><td>{x.tipo_examen}</td><td className="ajustar">{x.indicaciones || '—'}</td><td><Estado valor={x.estado} /></td>
                    <td className="ajustar">{x.resultado || 'En espera del laboratorio'}</td><td>{fechaHora(x.fecha_resultado)}</td>
                    <td className="numero">{x.estado === 'Completado' ? dinero(x.monto) : '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {editable && (
            <form className="fila-form caja" onSubmit={agregarExamen} style={{ marginTop: '1rem' }}>
              <div className="campo"><label htmlFor="tipo-ex">Examen a realizar</label><input id="tipo-ex" value={examen.tipo_examen} maxLength={100} onChange={(e) => setExamen({ ...examen, tipo_examen: e.target.value })} placeholder="Hematología completa" /></div>
              <div className="campo"><label htmlFor="ind-ex">Indicaciones</label><input id="ind-ex" value={examen.indicaciones} maxLength={300} onChange={(e) => setExamen({ ...examen, indicaciones: e.target.value })} placeholder="En ayunas" /></div>
              <button className="boton" type="submit" disabled={enviando}>Asignar examen</button>
            </form>
          )}
        </section>
      )}

      {vis.medicamentos && (vis.medicamentos.length > 0 || editable) && (
        <section className="seccion">
          <h2>Medicamentos</h2>
          {vis.medicamentos.length > 0 && (
            <div className="tabla-envoltura">
              <table>
                <thead><tr><th>Medicamento</th><th>Cantidad</th><th>Cómo tomarlo</th><th>Tiempo de aplicación</th><th>Estado</th><th className="numero">Costo</th></tr></thead>
                <tbody>{vis.medicamentos.map((m) => (
                  <tr key={m.id}><td>{m.medicamento}</td><td>{m.cantidad}</td><td className="ajustar">{m.dosis}, {m.frecuencia}{m.indicaciones ? `. ${m.indicaciones}` : ''}</td>
                    <td>{m.tiempo_aplicacion}</td><td><Estado valor={m.estado} /></td><td className="numero">{dinero(m.monto)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {editable && (
            <form className="fila-form caja" onSubmit={agregarMedicamento} style={{ marginTop: '1rem' }} noValidate>
              <div className="campo">
                <label htmlFor="med">Medicamento</label>
                <select id="med" value={med.medicamento_id} onChange={(e) => setMed({ ...med, medicamento_id: e.target.value })}>
                  <option value="">Seleccione…</option>
                  {catalogo.map((m) => <option key={m.id} value={m.id}>{m.nombre} {m.concentracion} ({m.presentacion})</option>)}
                </select>
              </div>
              <div className="campo"><label htmlFor="cant">Cantidad</label><input id="cant" type="number" min="1" step="1" value={med.cantidad} onChange={(e) => setMed({ ...med, cantidad: e.target.value })} /></div>
              <div className="campo"><label htmlFor="dosis">Dosis</label><input id="dosis" value={med.dosis} maxLength={60} onChange={(e) => setMed({ ...med, dosis: e.target.value })} placeholder="1 tableta" /></div>
              <div className="campo"><label htmlFor="frec">Frecuencia</label><input id="frec" value={med.frecuencia} maxLength={60} onChange={(e) => setMed({ ...med, frecuencia: e.target.value })} placeholder="Cada 8 horas" /></div>
              <div className="campo"><label htmlFor="tiempo">Tiempo de aplicación</label><input id="tiempo" value={med.tiempo_aplicacion} maxLength={60} onChange={(e) => setMed({ ...med, tiempo_aplicacion: e.target.value })} placeholder="7 días" /></div>
              <div className="campo"><label htmlFor="indic">Indicaciones</label><input id="indic" value={med.indicaciones} maxLength={300} onChange={(e) => setMed({ ...med, indicaciones: e.target.value })} placeholder="Después de comer" /></div>
              <button className="boton" type="submit" disabled={enviando}>Indicar medicamento</button>
            </form>
          )}
        </section>
      )}

      <Confirmar abierto={confirmar} titulo="Cerrar visita médica"
        mensaje="Al cerrarla ya no podrá modificar el diagnóstico, los exámenes ni los medicamentos de esta visita."
        textoConfirmar="Cerrar visita" onConfirmar={cerrar} onCancelar={() => setConfirmar(false)} />
    </>
  );
}
