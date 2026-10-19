'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { dinero } from '@/lib/formato';
import Aviso from '@/components/Aviso';

export default function Configuracion() {
  const { datos: cat, recargar } = useDatos('/catalogos');
  const [conf, setConf] = useState(null);
  const [med, setMed] = useState({ nombre: '', presentacion: '', concentracion: '', precio_unitario: '' });
  const [doc, setDoc] = useState({ nombres: '', apellidos: '', colegiado: '', especialidad_id: '', tipo: 'Especialista', telefono: '' });
  const [enf, setEnf] = useState({ nombres: '', apellidos: '', turno: 'Matutino', telefono: '' });
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  useEffect(() => { if (cat && !conf) setConf(cat.configuracion); }, [cat, conf]);

  const guardar = (ruta, metodo, datos, exito, limpiar) => async (e) => {
    e.preventDefault();
    if (await enviar(() => api(ruta, { metodo, datos }), exito)) { if (limpiar) limpiar(); recargar(); }
  };

  if (!cat || !conf) return <p className="cargando">Cargando…</p>;

  return (
    <>
      <div className="encabezado"><div><h1>Configuración</h1><p>Descuentos de la fundación y catálogos del sistema.</p></div></div>
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <section className="seccion">
        <h2>Precios especiales de la fundación</h2>
        <form className="fila-form caja" noValidate onSubmit={guardar('/catalogos/configuracion', 'PUT', conf, 'Descuentos actualizados. Se aplican a los nuevos cargos.')}>
          <div className="campo"><label htmlFor="dc">Descuento en consultas (%)</label><input id="dc" inputMode="decimal" value={conf.descuento_consulta} onChange={(e) => setConf({ ...conf, descuento_consulta: e.target.value })} /></div>
          <div className="campo"><label htmlFor="dl">Descuento en laboratorio (%)</label><input id="dl" inputMode="decimal" value={conf.descuento_laboratorio} onChange={(e) => setConf({ ...conf, descuento_laboratorio: e.target.value })} /></div>
          <div className="campo"><label htmlFor="df">Descuento en farmacia (%)</label><input id="df" inputMode="decimal" value={conf.descuento_farmacia} onChange={(e) => setConf({ ...conf, descuento_farmacia: e.target.value })} /></div>
          <div className="campo"><label htmlFor="pc">Precio normal de consulta (Q)</label><input id="pc" inputMode="decimal" value={conf.precio_consulta} onChange={(e) => setConf({ ...conf, precio_consulta: e.target.value })} /></div>
          <button className="boton" type="submit" disabled={enviando}>Guardar</button>
        </form>
      </section>

      <section className="seccion">
        <h2>Médicos</h2>
        <div className="tabla-envoltura"><table>
          <thead><tr><th>Nombre</th><th>Especialidad</th><th>Tipo</th></tr></thead>
          <tbody>{cat.medicos.map((m) => <tr key={m.id}><td>{m.nombres} {m.apellidos}</td><td>{m.especialidad}</td><td>{m.tipo === 'General' ? 'Médico general del asilo' : 'Especialista de la fundación'}</td></tr>)}</tbody>
        </table></div>
        <form className="fila-form caja" style={{ marginTop: '1rem' }} noValidate
          onSubmit={guardar('/catalogos/medicos', 'POST', { ...doc, especialidad_id: Number(doc.especialidad_id) || null }, 'Médico agregado.', () => setDoc({ ...doc, nombres: '', apellidos: '', colegiado: '', telefono: '' }))}>
          <div className="campo"><label htmlFor="mn">Nombres</label><input id="mn" maxLength={80} value={doc.nombres} onChange={(e) => setDoc({ ...doc, nombres: e.target.value })} /></div>
          <div className="campo"><label htmlFor="ma">Apellidos</label><input id="ma" maxLength={80} value={doc.apellidos} onChange={(e) => setDoc({ ...doc, apellidos: e.target.value })} /></div>
          <div className="campo"><label htmlFor="mc">Colegiado</label><input id="mc" maxLength={20} value={doc.colegiado} onChange={(e) => setDoc({ ...doc, colegiado: e.target.value })} /></div>
          <div className="campo"><label htmlFor="me">Especialidad</label>
            <select id="me" value={doc.especialidad_id} onChange={(e) => setDoc({ ...doc, especialidad_id: e.target.value })}>
              <option value="">Seleccione…</option>{cat.especialidades.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="mt">Tipo</label>
            <select id="mt" value={doc.tipo} onChange={(e) => setDoc({ ...doc, tipo: e.target.value })}>
              <option value="Especialista">Especialista de la fundación</option><option value="General">Médico general del asilo</option>
            </select></div>
          <button className="boton secundario" type="submit" disabled={enviando}>Agregar médico</button>
        </form>
      </section>

      <section className="seccion">
        <h2>Enfermeros(as)</h2>
        <div className="tabla-envoltura"><table>
          <thead><tr><th>Nombre</th><th>Turno</th></tr></thead>
          <tbody>{cat.enfermeros.map((x) => <tr key={x.id}><td>{x.nombres} {x.apellidos}</td><td>{x.turno}</td></tr>)}</tbody>
        </table></div>
        <form className="fila-form caja" style={{ marginTop: '1rem' }} noValidate
          onSubmit={guardar('/catalogos/enfermeros', 'POST', enf, 'Enfermero(a) agregado.', () => setEnf({ ...enf, nombres: '', apellidos: '', telefono: '' }))}>
          <div className="campo"><label htmlFor="en">Nombres</label><input id="en" maxLength={80} value={enf.nombres} onChange={(e) => setEnf({ ...enf, nombres: e.target.value })} /></div>
          <div className="campo"><label htmlFor="ea">Apellidos</label><input id="ea" maxLength={80} value={enf.apellidos} onChange={(e) => setEnf({ ...enf, apellidos: e.target.value })} /></div>
          <div className="campo"><label htmlFor="et">Turno</label>
            <select id="et" value={enf.turno} onChange={(e) => setEnf({ ...enf, turno: e.target.value })}>
              {['Matutino', 'Vespertino', 'Nocturno'].map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <button className="boton secundario" type="submit" disabled={enviando}>Agregar enfermero(a)</button>
        </form>
      </section>

      <section className="seccion">
        <h2>Medicamentos (precios de farmacia)</h2>
        <div className="tabla-envoltura"><table>
          <thead><tr><th>Medicamento</th><th>Presentación</th><th className="numero">Precio normal</th></tr></thead>
          <tbody>{cat.medicamentos.map((m) => <tr key={m.id}><td>{m.nombre} {m.concentracion}</td><td>{m.presentacion}</td><td className="numero">{dinero(m.precio_unitario)}</td></tr>)}</tbody>
        </table></div>
        <form className="fila-form caja" style={{ marginTop: '1rem' }} noValidate
          onSubmit={guardar('/catalogos/medicamentos', 'POST', med, 'Medicamento agregado.', () => setMed({ nombre: '', presentacion: '', concentracion: '', precio_unitario: '' }))}>
          <div className="campo"><label htmlFor="mdn">Nombre</label><input id="mdn" maxLength={100} value={med.nombre} onChange={(e) => setMed({ ...med, nombre: e.target.value })} /></div>
          <div className="campo"><label htmlFor="mdp">Presentación</label><input id="mdp" maxLength={50} value={med.presentacion} onChange={(e) => setMed({ ...med, presentacion: e.target.value })} placeholder="Tableta" /></div>
          <div className="campo"><label htmlFor="mdc">Concentración</label><input id="mdc" maxLength={30} value={med.concentracion} onChange={(e) => setMed({ ...med, concentracion: e.target.value })} placeholder="500 mg" /></div>
          <div className="campo"><label htmlFor="mdpr">Precio unitario (Q)</label><input id="mdpr" inputMode="decimal" value={med.precio_unitario} onChange={(e) => setMed({ ...med, precio_unitario: e.target.value })} /></div>
          <button className="boton secundario" type="submit" disabled={enviando}>Agregar medicamento</button>
        </form>
      </section>
    </>
  );
}
