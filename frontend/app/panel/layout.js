'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { leerSesion, cerrarSesion, NOMBRE_ROL, PERMISOS } from '@/lib/sesion';
import Algodon from '@/components/Algodon';

// Opciones del menú y roles que pueden verlas (el backend también valida cada permiso)
const MENU = [
  { ruta: '/panel', texto: 'Inicio', roles: null },
  { ruta: '/panel/residentes', texto: 'Residentes', roles: PERMISOS.verResidentes },
  { ruta: '/panel/usuarios', texto: 'Usuarios', roles: PERMISOS.gestionarUsuarios },
];

export default function PanelLayout({ children }) {
  const router = useRouter();
  const ruta = usePathname();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const revisar = () => {
      const sesion = leerSesion();
      if (!sesion) router.replace('/login');
      else setUsuario(sesion.usuario);
    };
    revisar();
    // Si se cerró sesión y el usuario presiona "atrás", la página no se vuelve a mostrar
    window.addEventListener('pageshow', revisar);
    return () => window.removeEventListener('pageshow', revisar);
  }, [router]);

  if (!usuario) return <p className="contenido cargando">Cargando…</p>;

  const opciones = MENU.filter((m) => !m.roles || m.roles.includes(usuario.rol));
  const esActivo = (r) => (r === '/panel' ? ruta === r : ruta.startsWith(r));

  function salir() {
    cerrarSesion();
    router.replace('/login');
  }

  return (
    <div className="panel">
      <aside className="lateral">
        <div className="marca">
          <Algodon />
          <span>SIGEVAN<br /><small>Cabeza de Algodón</small></span>
        </div>
        <nav className="menu" aria-label="Menú principal">
          {opciones.map((m) => (
            <Link key={m.ruta} href={m.ruta} className={esActivo(m.ruta) ? 'activo' : ''}>{m.texto}</Link>
          ))}
        </nav>
        <div className="usuario-actual">
          <div>
            <strong>{usuario.nombres} {usuario.apellidos}</strong>
            <span>{NOMBRE_ROL[usuario.rol] || usuario.rol}</span>
          </div>
          <button className="boton secundario chico" onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
