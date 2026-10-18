import { leerSesion, cerrarSesion } from './sesion';

// La URL del backend se configura en .env.local (no queda fija en el código)
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const sesion = leerSesion();
  const headers = { 'Content-Type': 'application/json' };
  if (sesion) headers.Authorization = `Bearer ${sesion.token}`;

  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers,
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Verifique que el backend esté encendido.');
  }

  const cuerpo = await res.json().catch(() => ({}));
  if (res.status === 401 && ruta !== '/auth/login') {
    cerrarSesion();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (!res.ok) {
    const error = new Error(cuerpo.mensaje || 'Ocurrió un error inesperado.');
    error.errores = cuerpo.errores || [];
    error.status = res.status;
    throw error;
  }
  return cuerpo;
}
