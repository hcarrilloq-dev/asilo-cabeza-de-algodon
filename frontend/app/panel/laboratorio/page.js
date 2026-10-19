'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { fechaHora, dinero } from '@/lib/formato';
import Aviso from '@/components/Aviso';

function FormResultado({ examen, onListo }) {
  const [form, setForm] = useState({ resultado: '', precio: '' });
  const { enviando, aviso, enviar } = useEnvio();
  async function guardar(e) {
    e.preventDefault();
    if (await enviar(() => api(`/laboratorio/examenes/${examen.id}/resultado`, { metodo: 'POST', datos: form }))) onListo();
  }
  return (
    <form className="formulario" onSubmit={guardar} noValidate style={{ marginTop: '.75rem', gap: '.75rem' }}>
      <Aviso aviso={aviso} />
      <div className="campo"><label htmlFor={`res-${examen.id}`}>Resultado</label><textarea id={`res-${examen.id}`} value={form.resultado} maxLength={2000} onChange={(e) => setForm({ ...form, resultado: e.target.value })} /></div>
      <div className="fila-form">
        <div className="campo"><label htmlFor={`pre-${examen.id}`}>Precio normal del examen (Q)</label><input id={`pre-${examen.id}`} inputMode="decimal" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} /><small>Se aplica el descuento de la fundación</small></div>
        <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar resultado'}</button>
      </div>
    </form>
  );
}

export default function Laboratorio() {
  const [estado, setEstado] = useState('Solicitado');
  const { datos: lista, error, recargar } = useDatos(`/laboratorio/examenes?estado=${estado}`);
  const [aviso, setAviso] = useState(null);

  return (
    <>
      <div className="encabezado"><div><h1>Laboratorio</h1><p>Exámenes asignados en las visitas médicas de los internos del asilo.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="pestanas" role="group" aria-label="Filtrar">
        <button aria-pressed={estado === 'Solicitado'} onClick={() => setEstado('Solicitado')}>Pendientes</button>
        <button aria-pressed={estado === 'Completado'} onClick={() => setEstado('Completado')}>Con resultado</button>
      </div>
      {error && <div className="mensaje error">{error}</div>}
      {lista && lista.length === 0 && <div className="caja vacio">No hay exámenes en esta lista.</div>}
      <div className="tarjetas">
        {(lista || []).map((x) => (
          <article key={x.id} className="tarjeta">
            <h3>{x.tipo_examen}</h3>
            <p className="meta">{x.residente} ({x.codigo}) · Visita del {fechaHora(x.fecha_visita)} · Dr(a). {x.medico}, {x.especialidad}</p>
            {x.indicaciones && <p style={{ margin: 0 }}><strong>Indicaciones:</strong> {x.indicaciones}</p>}
            {estado === 'Solicitado'
              ? <FormResultado examen={x} onListo={() => { setAviso({ tipo: 'exito', texto: `Resultado de ${x.tipo_examen} registrado. El médico ya lo puede consultar.` }); recargar(); }} />
              : <p style={{ margin: '.5rem 0 0' }}><strong>Resultado:</strong> {x.resultado} · {fechaHora(x.fecha_resultado)} · {dinero(x.monto)}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
