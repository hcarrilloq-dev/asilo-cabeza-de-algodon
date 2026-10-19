'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';
import { useDatos, useEnvio } from '@/lib/useDatos';
import { dinero, fechaHora, nuevaClave } from '@/lib/formato';
import Aviso from '@/components/Aviso';
import Estado from '@/components/Estado';
import MenuCaja from '@/components/MenuCaja';

function FormPago({ cita, onListo, onCancelar }) {
  const [form, setForm] = useState({ monto: String(cita.saldo), comprobante: '' });
  const [clave] = useState(nuevaClave);
  const { enviando, aviso, enviar } = useEnvio();
  async function pagar(e) {
    e.preventDefault();
    if (await enviar(() => api('/caja/fundacion/pagos', { metodo: 'POST', datos: { ...form, cita_id: cita.cita_id, clave_operacion: clave } }))) onListo();
  }
  return (
    <tr><td colSpan={9}>
      <form className="fila-form" onSubmit={pagar} noValidate>
        <div className="campo" style={{ gridColumn: '1 / -1' }}><Aviso aviso={aviso} /></div>
        <div className="campo"><label htmlFor={`fm-${cita.cita_id}`}>Monto (saldo {dinero(cita.saldo)})</label><input id={`fm-${cita.cita_id}`} inputMode="decimal" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
        <div className="campo"><label htmlFor={`fc-${cita.cita_id}`}>Comprobante</label><input id={`fc-${cita.cita_id}`} maxLength={30} value={form.comprobante} onChange={(e) => setForm({ ...form, comprobante: e.target.value })} /></div>
        <div className="acciones">
          <button className="boton" type="submit" disabled={enviando}>Registrar pago</button>
          <button className="boton secundario" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </td></tr>
  );
}

export default function Fundacion() {
  const [rol, setRol] = useState(null);
  const [estado, setEstado] = useState('');
  const { datos, error, recargar } = useDatos(`/caja/fundacion${estado ? `?estado=${estado}` : ''}`);
  const [pagando, setPagando] = useState(null);
  const [aviso, setAviso] = useState(null);
  useEffect(() => { const s = leerSesion(); setRol(s ? s.usuario.rol : null); }, []);
  const esAdmin = rol === 'Administrador';

  return (
    <>
      <div className="encabezado"><div><h1>Cuenta con la fundación</h1><p>Costo de cada cita (consulta, exámenes y medicamentos con descuento) y lo pagado.</p></div></div>
      {esAdmin && <MenuCaja />}
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <div className="pestanas" role="group" aria-label="Filtrar">
        {[['', 'Todas'], ['Pendiente', 'Sin pagar'], ['Parcial', 'Pago parcial'], ['Cancelada', 'Pagadas']].map(([v, t]) => (
          <button key={t} aria-pressed={estado === v} onClick={() => setEstado(v)}>{t}</button>
        ))}
      </div>
      {error && <div className="mensaje error">{error}</div>}
      {datos && (
        <>
          <div className="resumen"><div className="dato"><b>{dinero(datos.total_pendiente)}</b><span>Saldo pendiente con la fundación</span></div></div>
          <div className="tabla-envoltura">
            {datos.citas.length === 0 ? <div className="vacio">No hay citas en esta lista.</div> : (
              <table>
                <thead><tr><th>Cita</th><th>Interno</th><th>Especialidad</th><th className="numero">Consulta</th><th className="numero">Exámenes</th><th className="numero">Medicamentos</th><th className="numero">Saldo</th><th>Estado</th><th /></tr></thead>
                <tbody>{datos.citas.map((c) => (
                  <FilaCita key={c.cita_id} c={c} esAdmin={esAdmin} pagando={pagando === c.cita_id}
                    onPagar={() => setPagando(c.cita_id)} onCancelar={() => setPagando(null)}
                    onListo={() => { setPagando(null); setAviso({ tipo: 'exito', texto: 'Pago a la fundación registrado.' }); recargar(); }} />
                ))}</tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

function FilaCita({ c, esAdmin, pagando, onPagar, onCancelar, onListo }) {
  return (
    <>
      <tr>
        <td>{fechaHora(c.fecha_hora)}</td><td>{c.residente}</td><td>{c.especialidad}</td>
        <td className="numero">{dinero(c.costo_consulta)}</td><td className="numero">{dinero(c.costo_examenes)}</td>
        <td className="numero">{dinero(c.costo_medicamentos)}</td><td className="numero total">{dinero(c.saldo)}</td>
        <td><Estado valor={c.estado_pago === 'Cancelada' ? 'Pagada' : c.estado_pago} /></td>
        <td>{esAdmin && c.saldo > 0 && !pagando && <button className="boton chico" onClick={onPagar}>Pagar</button>}</td>
      </tr>
      {pagando && <FormPago cita={c} onListo={onListo} onCancelar={onCancelar} />}
    </>
  );
}
