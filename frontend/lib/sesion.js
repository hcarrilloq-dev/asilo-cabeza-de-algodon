const CLAVE = 'asilo_sesion';

export function guardarSesion(token, usuario) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ token, usuario })); } catch {}
}

export function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE));
    return s && s.token ? s : null;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  try { localStorage.removeItem(CLAVE); } catch {}
}

export const NOMBRE_ROL = {
  Administrador: 'Administrador',
  Recepcion: 'Recepción',
  Medico: 'Médico',
  Enfermeria: 'Enfermería',
  Contabilidad: 'Contabilidad',
  Familiar: 'Familiar',
};
