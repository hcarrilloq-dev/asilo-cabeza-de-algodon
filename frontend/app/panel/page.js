'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { leerSesion, NOMBRE_ROL, puede } from '@/lib/sesion';
import { useDatos } from '@/lib/useDatos';
import { dinero, fecha, fechaHora } from '@/lib/formato';
import Estado from '@/components/Estado';

// Qué hace cada rol en el sistema y a dónde ir (flujo del enunciado)
const ACCESOS = {
  Administrador: [['/panel/residentes', 'Internos'], ['/panel/familiares', 'Familiares'], ['/panel/caja', 'Caja'], ['/panel/usuarios', 'Usuarios']],
  MedicoGeneral: [['/panel/solicitudes/nueva', 'Referir a especialista'], ['/panel/residentes', 'Fichas de internos'], ['/panel/solicitudes', 'Solicitudes']],
  MedicoEspecialista: [['/panel/citas', 'Mis citas']],
  Enfermeria: [['/panel/citas', 'Citas que acompaño'], ['/panel/enfermeria', 'Medicamentos a aplicar']],
  Fundacion: [['/panel/solicitudes', 'Solicitudes por asignar'], ['/panel/caja/fundacion', 'Cuenta del asilo']],
  Laboratorio: [['/panel/laboratorio', 'Exámenes pendientes']],
  Farmacia: [['/panel/farmacia', 'Medicamentos por entregar']],
};

function PortalFamiliar() {
  const { datos, error } = useDatos('/portal');
  if (error) return <div className="mensaje error">{error}</div>;
  if (!datos) return <p className="cargando">Cargando…</p>;
  if (!datos.internos.length) return <div className="caja">Su usuario aún no está vinculado a ningún interno. Comuníquese con la administración del asilo.</div>;
  return datos.internos.map((i) => (
    <section key={i.id} className="seccion">
      <h2>{i.residente} <span className="texto-suave">({i.parentesco})</span></h2>
      <div className="resumen">
        <div className="dato"><b>{dinero(i.total_cargos)}</b><span>Total cargado</span></div>
        <div className="dato"><b>{dinero(i.total_pagos)}</b><span>Total pagado</span></div>
        <div className="dato"><b>{dinero(i.saldo)}</b><span>Saldo pendiente</span></div>
      </div>
      {i.cargos.length > 0 && (
        <div className="tabla-envoltura" style={{ marginBottom: '1rem' }}><table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="numero">Precio</th><th className="numero">Descuento</th><th className="numero">A pagar</th><th>Estado</th></tr></thead>
          <tbody>{i.cargos.map((c) => <tr key={c.id}><td>{fecha(c.fecha)}</td><td>{c.concepto}</td><td className="numero">{dinero(c.monto_base)}</td><td className="numero">{Number(c.descuento_pct)} %</td><td className="numero">{dinero(c.monto)}</td><td><Estado valor={c.estado} /></td></tr>)}</tbody>
        </table></div>
      )}
      {i.citas.length > 0 && (
        <div className="tabla-envoltura"><table>
          <thead><tr><th>Referido a</th><th>Fecha de la solicitud</th><th>Cita</th><th>Médico</th><th>Estado</th></tr></thead>
          <tbody>{i.citas.map((c, n) => <tr key={n}><td>{c.especialidad}</td><td>{fechaHora(c.fecha_solicitud)}</td><td>{fechaHora(c.fecha_hora)}</td><td>{c.medico || 'Por asignar'}</td><td><Estado valor={c.estado} /></td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  ));
}

export default function PanelInicio() {
  const [usuario, setUsuario] = useState(null);
  useEffect(() => { const s = leerSesion(); setUsuario(s ? s.usuario : null); }, []);
  const verResidentes = usuario && puede(usuario, 'verResidentes');
  const { datos: residentes } = useDatos(verResidentes ? '/residentes?estado=' : null);

  if (!usuario) return null;
  const activos = residentes ? residentes.filter((r) => r.estado === 'Activo').length : null;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Hola, {usuario.nombres}</h1>
          <p>Ingresó como {NOMBRE_ROL[usuario.rol] || usuario.rol}.</p>
        </div>
        {puede(usuario, 'editarResidentes') && <Link className="boton" href="/panel/residentes/nuevo">Registrar interno</Link>}
      </div>

      {usuario.rol === 'Familiar' ? <PortalFamiliar /> : (
        <>
          {residentes && (
            <div className="resumen">
              <div className="dato"><b>{activos}</b><span>Internos activos</span></div>
              <div className="dato"><b>{residentes.length - activos}</b><span>Egresados o fallecidos</span></div>
              <div className="dato"><b>{residentes.length}</b><span>Fichas en total</span></div>
            </div>
          )}
          <section className="caja">
            <h2>Accesos rápidos</h2>
            <div className="acciones" style={{ marginTop: '1rem' }}>
              {(ACCESOS[usuario.rol] || []).map(([href, texto]) => <Link key={href} className="boton secundario" href={href}>{texto}</Link>)}
            </div>
          </section>
        </>
      )}
    </>
  );
}
