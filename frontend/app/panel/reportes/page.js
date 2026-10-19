'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';
import { useDatos } from '@/lib/useDatos';
import { dinero, fecha, fechaHora, hoyISO } from '@/lib/formato';
import Estado from '@/components/Estado';

// Los siete reportes del enunciado
const REPORTES = [
  { id: 'costos-citas', titulo: 'Costos de cada cita por paciente', roles: ['Administrador'],
    descripcion: 'Informe estadístico del costo de cada cita, con sus exámenes de laboratorio y medicamentos (precios con descuento).' },
  { id: 'analisis-medicos', titulo: 'Análisis médicos por paciente', roles: ['Administrador', 'MedicoGeneral'], porPaciente: true,
    descripcion: 'Ficha médica del interno, motivo de cada atención, diagnóstico y medicamentos.' },
  { id: 'cobros', titulo: 'Cobros por paciente', roles: ['Administrador'],
    descripcion: 'Cargos a la cuenta del familiar por rango de fecha, con los gastos médicos como detalle, y los pagos recibidos.' },
  { id: 'pagos-fundacion', titulo: 'Pagos a la fundación', roles: ['Administrador'],
    descripcion: 'Pagos realizados a la fundación por consultas, exámenes y medicamentos.' },
  { id: 'entradas', titulo: 'Entradas: donaciones y cobros', roles: ['Administrador'],
    descripcion: 'Todo el dinero que ingresó al asilo en el periodo.' },
  { id: 'examenes', titulo: 'Exámenes realizados por paciente', roles: ['Administrador', 'MedicoGeneral'],
    descripcion: 'Exámenes de laboratorio asignados en las visitas, con su resultado.' },
  { id: 'medicamentos', titulo: 'Medicamentos aplicados por paciente', roles: ['Administrador', 'MedicoGeneral'],
    descripcion: 'Medicamentos indicados, entregados por farmacia y aplicaciones registradas por enfermería.' },
];

const inicioAnio = () => `${hoyISO().slice(0, 4)}-01-01`;

function Tabla({ columnas, filas }) {
  if (!filas.length) return <div className="caja vacio">No hay datos en el periodo seleccionado.</div>;
  return (
    <div className="tabla-envoltura">
      <table>
        <thead><tr>{columnas.map((c) => <th key={c.k} className={c.dinero ? 'numero' : ''}>{c.t}</th>)}</tr></thead>
        <tbody>{filas.map((f, i) => (
          <tr key={i}>{columnas.map((c) => {
            const val = f[c.k];
            let cont = val ?? '—';
            if (c.dinero) cont = dinero(val);
            else if (c.fecha) cont = fecha(val);
            else if (c.fechaHora) cont = fechaHora(val);
            else if (c.estado) cont = <Estado valor={val} />;
            return <td key={c.k} className={c.dinero ? 'numero' : c.largo ? 'ajustar' : ''}>{cont}</td>;
          })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const Datos = ({ items }) => (
  <div className="resumen">{items.map(([t, v]) => <div className="dato" key={t}><b>{v}</b><span>{t}</span></div>)}</div>
);

/** Barras horizontales simples para las estadísticas */
function Barras({ titulo, filas, etiqueta, valor }) {
  if (!filas || !filas.length) return null;
  const max = Math.max(...filas.map((f) => Number(f[valor]))) || 1;
  return (
    <section className="caja" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{titulo}</h3>
      <div className="barras">
        {filas.map((f) => (
          <div className="barra" key={f[etiqueta]}>
            <span>{f[etiqueta]}</span>
            <div className="barra-pista"><div className="barra-relleno" style={{ width: `${(Number(f[valor]) / max) * 100}%` }} /></div>
            <b>{dinero(f[valor])}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function Resultado({ id, d }) {
  const t = d.totales || {};
  switch (id) {
    case 'costos-citas':
      return <>
        <Datos items={[['Citas', t.citas], ['Consultas', dinero(t.consultas)], ['Exámenes', dinero(t.examenes)], ['Medicamentos', dinero(t.medicamentos)], ['Total', dinero(t.total)], ['Promedio por cita', dinero(t.promedio_por_cita)]]} />
        <Barras titulo="Costo total por paciente" filas={d.por_paciente} etiqueta="residente" valor="total" />
        <Barras titulo="Costo total por especialidad" filas={d.por_especialidad} etiqueta="especialidad" valor="total" />
        <Tabla filas={d.filas} columnas={[{ k: 'fecha_hora', t: 'Cita', fechaHora: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'especialidad', t: 'Especialidad' }, { k: 'medico', t: 'Médico' },
          { k: 'costo_consulta', t: 'Consulta', dinero: 1 }, { k: 'costo_examenes', t: 'Exámenes', dinero: 1 }, { k: 'costo_medicamentos', t: 'Medicamentos', dinero: 1 }, { k: 'costo_total', t: 'Total', dinero: 1 }, { k: 'estado_pago', t: 'Pago', estado: 1 }]} />
      </>;
    case 'analisis-medicos': {
      const f = d.ficha;
      return <>
        <section className="caja" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>{f.residente} ({f.codigo})</h3>
          <dl className="detalle">
            <div><dt>Edad</dt><dd>{f.edad} años</dd></div><div><dt>Ingreso</dt><dd>{fecha(f.fecha_ingreso)}</dd></div>
            <div><dt>Tipo de sangre</dt><dd>{f.tipo_sangre || '—'}</dd></div><div><dt>Estado</dt><dd>{f.estado}</dd></div>
            <div className="ancho"><dt>Psicopatologías</dt><dd>{f.psicopatologias || '—'}</dd></div>
            <div className="ancho"><dt>Medicamentos de cajón</dt><dd>{f.medicamentos_cajon || '—'}</dd></div>
            <div><dt>Alergias</dt><dd>{f.alergias || '—'}</dd></div><div><dt>Condiciones médicas</dt><dd>{f.condiciones_medicas || '—'}</dd></div>
          </dl>
        </section>
        <Tabla filas={d.filas} columnas={[{ k: 'fecha_visita', t: 'Fecha', fechaHora: 1 }, { k: 'especialidad', t: 'Especialidad' }, { k: 'medico', t: 'Médico tratante' }, { k: 'motivo', t: 'Motivo', largo: 1 },
          { k: 'examenes', t: 'Exámenes y resultados', largo: 1 }, { k: 'diagnostico', t: 'Diagnóstico', largo: 1 }, { k: 'medicamentos', t: 'Medicamentos', largo: 1 }, { k: 'observaciones', t: 'Observaciones', largo: 1 }]} />
      </>;
    }
    case 'cobros':
      return <>
        <Datos items={[['Total cargado', dinero(t.cargado)], ['Gastos médicos', dinero(t.gastos_medicos)], ['Cuotas', dinero(t.cuotas)], ['Ahorro por descuento de la fundación', dinero(t.descuento_fundacion)], ['Cobrado', dinero(t.cobrado)]]} />
        <h3>Cargos</h3>
        <Tabla filas={d.filas} columnas={[{ k: 'fecha', t: 'Fecha', fecha: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'tipo', t: 'Tipo' }, { k: 'concepto', t: 'Detalle', largo: 1 },
          { k: 'monto_base', t: 'Precio', dinero: 1 }, { k: 'monto', t: 'Con descuento', dinero: 1 }, { k: 'pagado', t: 'Pagado', dinero: 1 }, { k: 'saldo', t: 'Saldo', dinero: 1 }, { k: 'estado', t: 'Estado', estado: 1 }]} />
        <h3>Pagos recibidos</h3>
        <Tabla filas={d.pagos} columnas={[{ k: 'numero_recibo', t: 'Recibo' }, { k: 'fecha', t: 'Fecha', fecha: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'concepto', t: 'Concepto', largo: 1 }, { k: 'metodo', t: 'Método' }, { k: 'monto', t: 'Monto', dinero: 1 }]} />
      </>;
    case 'pagos-fundacion':
      return <>
        <Datos items={[['Pagos realizados', t.pagos], ['Total pagado', dinero(t.pagado)], ['Deuda pendiente actual', dinero(t.deuda_pendiente)]]} />
        <Tabla filas={d.filas} columnas={[{ k: 'fecha', t: 'Fecha de pago', fecha: 1 }, { k: 'comprobante', t: 'Comprobante' }, { k: 'fecha_cita', t: 'Cita', fechaHora: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'especialidad', t: 'Especialidad' }, { k: 'monto', t: 'Monto', dinero: 1 }]} />
      </>;
    case 'entradas':
      return <>
        <Datos items={[['Donaciones', dinero(t.donaciones)], ['Cobros', dinero(t.cobros)], ['Total de entradas', dinero(t.total)]]} />
        <Barras titulo="Donaciones por tipo de donante" filas={d.por_tipo_donante} etiqueta="tipo_donante" valor="total" />
        <Tabla filas={d.filas} columnas={[{ k: 'fecha', t: 'Fecha', fecha: 1 }, { k: 'origen', t: 'Origen' }, { k: 'detalle', t: 'Detalle', largo: 1 }, { k: 'de_quien', t: 'De' }, { k: 'documento', t: 'Recibo' }, { k: 'monto', t: 'Monto', dinero: 1 }]} />
      </>;
    case 'examenes':
      return <>
        <Datos items={[['Exámenes', t.examenes], ['Con resultado', t.completados], ['Pendientes', t.pendientes], ['Costo (con descuento)', dinero(t.costo)]]} />
        <Tabla filas={d.filas} columnas={[{ k: 'fecha_visita', t: 'Visita', fechaHora: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'tipo_examen', t: 'Examen' }, { k: 'medico', t: 'Médico' },
          { k: 'estado', t: 'Estado', estado: 1 }, { k: 'resultado', t: 'Resultado', largo: 1 }, { k: 'monto', t: 'Costo', dinero: 1 }]} />
      </>;
    case 'medicamentos':
      return <>
        <Datos items={[['Indicados', t.indicados], ['Entregados', t.entregados], ['Aplicaciones de enfermería', t.aplicaciones], ['Costo (con descuento)', dinero(t.costo)]]} />
        <Tabla filas={d.filas} columnas={[{ k: 'fecha_visita', t: 'Visita', fechaHora: 1 }, { k: 'residente', t: 'Paciente' }, { k: 'medicamento', t: 'Medicamento' }, { k: 'cantidad', t: 'Cantidad' },
          { k: 'tiempo_aplicacion', t: 'Tiempo' }, { k: 'estado', t: 'Estado', estado: 1 }, { k: 'aplicaciones', t: 'Aplicaciones' }, { k: 'monto', t: 'Costo', dinero: 1 }]} />
      </>;
    default: return null;
  }
}

export default function Reportes() {
  const [rol, setRol] = useState(null);
  const [rep, setRep] = useState(null);
  const [f, setF] = useState({ residente_id: '', desde: inicioAnio(), hasta: hoyISO() });
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { datos: internos } = useDatos(rol ? '/residentes?estado=' : null);

  useEffect(() => { const s = leerSesion(); setRol(s ? s.usuario.rol : null); }, []);
  const disponibles = REPORTES.filter((r) => rol && r.roles.includes(rol));
  const actual = REPORTES.find((r) => r.id === rep);

  async function generar(e) {
    e.preventDefault();
    setError(''); setDatos(null);
    if (actual.porPaciente && !f.residente_id) { setError('Seleccione el interno.'); return; }
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    setCargando(true);
    try { setDatos(await api(`/reportes/${rep}?${q}`)); } catch (err) { setError(err.message); }
    setCargando(false);
  }

  const nombreInterno = f.residente_id && internos ? (internos.find((i) => String(i.id) === String(f.residente_id)) || {}) : null;

  return (
    <>
      <div className="encabezado no-imprimir"><div><h1>Reportes</h1><p>Elija un reporte, el periodo y, si quiere, un interno.</p></div></div>

      {!rep && (
        <div className="tarjetas">
          {disponibles.map((r) => (
            <button key={r.id} className="tarjeta tarjeta-boton" onClick={() => { setRep(r.id); setDatos(null); setError(''); }}>
              <h3>{r.titulo}</h3><p className="meta" style={{ margin: 0 }}>{r.descripcion}</p>
            </button>
          ))}
        </div>
      )}

      {actual && (
        <>
          <form className="fila-form caja no-imprimir" onSubmit={generar} style={{ marginBottom: '1.5rem' }}>
            <div className="campo">
              <label htmlFor="rep-int">Interno{actual.porPaciente ? ' *' : ''}</label>
              <select id="rep-int" value={f.residente_id} onChange={(e) => setF({ ...f, residente_id: e.target.value })}>
                <option value="">{actual.porPaciente ? 'Seleccione…' : 'Todos'}</option>
                {(internos || []).map((i) => <option key={i.id} value={i.id}>{i.apellidos}, {i.nombres}</option>)}
              </select>
            </div>
            <div className="campo"><label htmlFor="rep-desde">Desde</label><input id="rep-desde" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
            <div className="campo"><label htmlFor="rep-hasta">Hasta</label><input id="rep-hasta" type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
            <div className="acciones">
              <button className="boton" type="submit" disabled={cargando}>{cargando ? 'Generando…' : 'Generar'}</button>
              <button className="boton secundario" type="button" onClick={() => { setRep(null); setDatos(null); }}>Otro reporte</button>
            </div>
          </form>
          {error && <div className="mensaje error" role="alert">{error}</div>}
          {datos && (
            <article className="reporte">
              <header className="encabezado">
                <div>
                  <p className="texto-suave" style={{ margin: 0 }}>SIGEVAN · Asilo de Ancianos Cabeza de Algodón</p>
                  <h2 style={{ fontSize: '1.5rem' }}>{actual.titulo}</h2>
                  <p>Del {fecha(f.desde)} al {fecha(f.hasta)}{nombreInterno && nombreInterno.id ? ` · ${nombreInterno.nombres} ${nombreInterno.apellidos}` : ''} · Generado el {new Date().toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <button className="boton secundario no-imprimir" onClick={() => window.print()}>Imprimir o guardar PDF</button>
              </header>
              <Resultado id={rep} d={datos} />
            </article>
          )}
        </>
      )}
    </>
  );
}
