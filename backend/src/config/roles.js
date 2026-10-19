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

const { ADMIN, MEDICO_GENERAL, ESPECIALISTA, ENFERMERIA, FUNDACION, LABORATORIO, FARMACIA, FAMILIAR } = ROLES;

const PERMISOS = {
  // Ficha del interno (incluye psicopatologías): solo personal clínico del asilo y el especialista
  verResidentes: [ADMIN, MEDICO_GENERAL, ESPECIALISTA, ENFERMERIA],
  editarResidentes: [ADMIN, MEDICO_GENERAL],
  gestionarUsuarios: [ADMIN],
  // Familiares
  verFamiliares: [ADMIN, MEDICO_GENERAL],
  editarFamiliares: [ADMIN],
  // Flujo médico
  crearSolicitud: [MEDICO_GENERAL],
  verSolicitudes: [ADMIN, MEDICO_GENERAL, ENFERMERIA, FUNDACION],
  asignarCita: [FUNDACION],
  verCitas: [ADMIN, MEDICO_GENERAL, ESPECIALISTA, ENFERMERIA, FUNDACION],
  atenderVisita: [ESPECIALISTA],
  verHistorial: [ADMIN, MEDICO_GENERAL, ESPECIALISTA, ENFERMERIA],
  laboratorio: [LABORATORIO],
  farmacia: [FARMACIA],
  administrarMedicamento: [ENFERMERIA],
  // Caja
  caja: [ADMIN],
  verDeudaFundacion: [ADMIN, FUNDACION],
  portalFamiliar: [FAMILIAR],
  catalogos: [ADMIN, MEDICO_GENERAL, ESPECIALISTA, ENFERMERIA, FUNDACION, LABORATORIO, FARMACIA],
  configuracion: [ADMIN],
};

module.exports = { ROLES, TODOS, PERMISOS };
