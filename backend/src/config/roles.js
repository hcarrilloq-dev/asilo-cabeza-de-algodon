/**
 * Roles del sistema (según el análisis de SIGEVAN y el enunciado del proyecto)
 * y grupos de permisos usados por las rutas. Fuente única: si cambia un permiso,
 * se cambia aquí.
 */
const ROLES = {
  ADMIN: 'Administrador',
  MEDICO_GENERAL: 'MedicoGeneral',
  ESPECIALISTA: 'MedicoEspecialista',
  ENFERMERIA: 'Enfermeria',
  FUNDACION: 'Fundacion',
  LABORATORIO: 'Laboratorio',
  FARMACIA: 'Farmacia',
  FAMILIAR: 'Familiar',
};

const TODOS = Object.values(ROLES);

const PERMISOS = {
  // Ficha del interno (incluye psicopatologías): solo personal clínico del asilo y el especialista
  verResidentes: [ROLES.ADMIN, ROLES.MEDICO_GENERAL, ROLES.ESPECIALISTA, ROLES.ENFERMERIA],
  editarResidentes: [ROLES.ADMIN, ROLES.MEDICO_GENERAL],
  gestionarUsuarios: [ROLES.ADMIN],
};

module.exports = { ROLES, TODOS, PERMISOS };
