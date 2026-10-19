'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { leerSesion, NOMBRE_ROL, puede } from '@/lib/sesion';


export default function PanelInicio() {
  const [usuario, setUsuario] = useState(null);
  const [residentes, setResidentes] = useState(null);

  useEffect(() => {
    const { usuario: u } = leerSesion() || {};
    setUsuario(u);
    if (puede(u, 'verResidentes')) {
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
        {puede(usuario, 'editarResidentes') && (
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
          <li><span>Ficha de internos (psicopatologías y medicamentos de cajón)</span><span className="etiqueta si">Disponible</span></li>
          <li><span>Familiares y responsables de pago</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Evaluaciones, solicitudes y citas médicas</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Laboratorio y farmacia</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Caja: cargos, pagos, cuotas, donaciones y gastos</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Reportes</span><span className="etiqueta no">En desarrollo</span></li>
          <li><span>Correo al familiar al crear una solicitud</span><span className="etiqueta no">En desarrollo</span></li>
        </ul>
      </section>
    </>
  );
}
