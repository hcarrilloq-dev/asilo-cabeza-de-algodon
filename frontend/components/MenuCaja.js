'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const OPCIONES = [
  ['/panel/caja', 'Resumen'],
  ['/panel/caja/cuentas', 'Cuentas y pagos'],
  ['/panel/caja/donaciones', 'Donaciones'],
  ['/panel/caja/gastos', 'Gastos'],
  ['/panel/caja/fundacion', 'Fundación'],
];

export default function MenuCaja() {
  const ruta = usePathname();
  return (
    <nav className="pestanas" aria-label="Secciones de caja">
      {OPCIONES.map(([href, texto]) => (
        <Link key={href} href={href} className={`pestana-enlace${ruta === href ? ' activa' : ''}`} aria-current={ruta === href ? 'page' : undefined}>{texto}</Link>
      ))}
    </nav>
  );
}
