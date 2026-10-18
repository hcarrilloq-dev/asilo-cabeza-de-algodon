'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { leerSesion, NOMBRE_ROL } from '@/lib/sesion';

const PUEDE_VER_RESIDENTES = ['Administrador', 'Recepcion', 'Medico', 'Enfermeria', 'Contabilidad'];

export default function PanelInicio() {
  const [usuario, setUsuario] = useState(null);
  const [residentes, setResidentes] = useState(null);

  useEffect(() => {
    const { usuario: u } = leerSesion() || {};
    setUsuario(u);
    if (u && PUEDE_VER_RESIDENTES.includes(u.rol)) {
      api('/residentes').then(setResidentes).catch(() => setResidentes([]));
    }
  }, []);

  if (!usuario) return null;
  const activos = residentes ? residentes.filter((r) => r.estado === 'Activo').length : null;
  const egresados = residentes ? residentes.filter((r) => r.estado === 'Egresado').length : null;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Hola, {usuario.nombres}</h1>
          <p>Ingresó como {NOMBRE_ROL[usuario.rol] || usuario.rol}.</p>
        </div>
        {['Administrador', 'Recepcion'].includes(usuario.rol) && (
          <Link className="boton" href="/panel/residentes/nuevo">Registrar residente</Link>
        )}
      </div>

      {residentes && (
        <div className="resumen">
          <div className="dato"><b>{activos}</b><span>Residentes activos</span></div>
          <div className="dato"><b>{egresados}</b><span>Egresados</span></div>
          <div className="dato"><b>{residentes.length}</b><span>Expedientes en total</span></div>
        </div>
      )}

      <section className="caja">
        <h2>Avance del sistema</h2>
        <ul className="modulos">
          <li><span>Inicio de sesión y control de acceso por roles</span><span className="etiqueta si">Disponible</span></li>
          <li><span>Gestión de usuarios</span><span className="etiqueta si">Disponible</span></li>
          <li><span>Expedientes de residentes</span><span className="etiqueta si">Disponible</span></li>
          <li><span>Familiares y responsables de pago</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Evaluaciones, solicitudes y citas médicas</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Medicamentos y recetas</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Cuotas, pagos y estado de cuenta</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Reportes</span><span className="etiqueta no">En desarrollo</span></li>
        </ul>
      </section>
    </>
  );
}
