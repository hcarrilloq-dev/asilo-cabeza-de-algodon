const CLAVE = 'asilo_sesion';

export function guardarSesion(token, usuario) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ token, usuario })); } catch {}
}

export function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE));
    if (!s || !s.token) return null;
    // Si el token ya venció, se descarta la sesión
    const datos = JSON.parse(atob(s.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (datos.exp && datos.exp * 1000 < Date.now()) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  try { localStorage.removeItem(CLAVE); } catch {}
}

export const NOMBRE_ROL = {
  Administrador: 'Administrador',
  MedicoGeneral: 'Médico general',
  MedicoEspecialista: 'Médico especialista',
  Enfermeria: 'Enfermería',
  Fundacion: 'Fundación',
  Laboratorio: 'Laboratorio',
  Farmacia: 'Farmacia',
  Familiar: 'Familiar responsable',
};

// Mismos grupos que el backend (src/config/roles.js); el backend es quien realmente valida
export const PERMISOS = {
  verResidentes: ['Administrador', 'MedicoGeneral', 'MedicoEspecialista', 'Enfermeria'],
  editarResidentes: ['Administrador', 'MedicoGeneral'],
  gestionarUsuarios: ['Administrador'],
  verFamiliares: ['Administrador'],
  editarFamiliares: ['Administrador'],
  crearSolicitud: ['MedicoGeneral'],
  verSolicitudes: ['Administrador', 'MedicoGeneral', 'Enfermeria', 'Fundacion'],
  asignarCita: ['Fundacion'],
  verCitas: ['Administrador', 'MedicoGeneral', 'MedicoEspecialista', 'Enfermeria', 'Fundacion'],
  atenderVisita: ['MedicoEspecialista'],
  laboratorio: ['Laboratorio'],
  farmacia: ['Farmacia'],
  enfermeria: ['Enfermeria'],
  caja: ['Administrador'],
  verDeudaFundacion: ['Administrador', 'Fundacion'],
  configuracion: ['Administrador'],
};

export const puede = (usuario, permiso) => !!usuario && PERMISOS[permiso].includes(usuario.rol);
