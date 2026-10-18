'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';

function edad(fecha) {
  const n = new Date(`${fecha}T00:00:00`);
  const h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e -= 1;
  return e;
}

export default function Residentes() {
  const [lista, setLista] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [error, setError] = useState('');
  const [puedeRegistrar, setPuedeRegistrar] = useState(false);

  useEffect(() => {
    const s = leerSesion();
    setPuedeRegistrar(!!s && ['Administrador', 'Recepcion'].includes(s.usuario.rol));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      if (buscar.trim()) q.set('buscar', buscar.trim());
      if (estado) q.set('estado', estado);
      api(`/residentes?${q}`).then((d) => { setLista(d); setError(''); }).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [buscar, estado]);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Residentes</h1>
          <p>Expedientes de las personas que viven en el asilo.</p>
        </div>
        {puedeRegistrar && <Link className="boton" href="/panel/residentes/nuevo">Registrar residente</Link>}
      </div>

      <div className="filtros">
        <input type="search" placeholder="Buscar por nombre, código o DPI" value={buscar}
          onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar residente" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="Activo">Activos</option>
          <option value="Egresado">Egresados</option>
          <option value="Fallecido">Fallecidos</option>
          <option value="">Todos</option>
        </select>
      </div>

      {error && <div className="mensaje error" role="alert">{error}</div>}
      {!lista && !error && <p className="cargando">Cargando residentes…</p>}

      {lista && (
        <div className="tabla-envoltura">
          {lista.length === 0 ? (
            <div className="vacio">
              {buscar ? 'Ningún residente coincide con la búsqueda.' : 'Aún no hay residentes en esta lista.'}
              {puedeRegistrar && !buscar && <p><Link href="/panel/residentes/nuevo">Registrar el primero</Link></p>}
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Código</th><th>Nombre</th><th>Edad</th><th>Habitación</th><th>Ingreso</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id}>
                    <td>{r.codigo}</td>
                    <td>{r.apellidos}, {r.nombres}</td>
                    <td>{edad(r.fecha_nacimiento)} años</td>
                    <td>{r.habitacion || '—'}</td>
                    <td>{r.fecha_ingreso}</td>
                    <td><span className={`etiqueta ${r.estado}`}>{r.estado}</span></td>
                    <td><Link href={`/panel/residentes/${r.id}`}>Ver expediente</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
