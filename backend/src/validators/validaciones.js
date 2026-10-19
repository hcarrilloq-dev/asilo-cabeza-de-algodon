const { TODOS: ROLES } = require('../config/roles');
const ESTADOS_RESIDENTE = ['Activo', 'Egresado', 'Fallecido'];
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
const esTexto = (v) => typeof v === 'string';
const muyLargo = (v, max) => esTexto(v) && v.trim().length > max;

// Límites de texto (coinciden con el tamaño de las columnas en la base de datos)
const LIMITES = {
  nombres: 80, apellidos: 80, alergias: 300, condiciones_medicas: 500, psicopatologias: 500,
  medicamentos_cajon: 500, observaciones: 500, habitacion: 10,
};

function esEmailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Convierte el parámetro :id de la ruta en número entero positivo, o null si no es válido. */
function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

/** Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número. */
function esPasswordSegura(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password);
}

/** DPI de Guatemala: 13 dígitos. */
function esDpiValido(dpi) {
  return /^\d{13}$/.test(String(dpi));
}

function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

function calcularEdad(fechaNacimiento, hoy = new Date()) {
  const nac = new Date(`${fechaNacimiento}T00:00:00`);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad;
}

function validarLogin(datos) {
  const errores = [];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return ['Envíe el correo y la contraseña.'];
  const { email, password } = datos;
  if (vacio(email)) errores.push('El correo es obligatorio.');
  else if (!esTexto(email) || !esEmailValido(email)) errores.push('El correo no tiene un formato válido.');
  if (vacio(password)) errores.push('La contraseña es obligatoria.');
  else if (!esTexto(password)) errores.push('La contraseña debe enviarse como texto.');
  else if (password.length > 100) errores.push('La contraseña es demasiado larga.');
  return errores;
}

function validarUsuario({ nombres, apellidos, email, password, rol } = {}, { esNuevo = true } = {}) {
  const errores = [];
  if (vacio(nombres) || !esTexto(nombres)) errores.push('Los nombres son obligatorios.');
  else if (muyLargo(nombres, 80)) errores.push('Los nombres no pueden pasar de 80 caracteres.');
  if (vacio(apellidos) || !esTexto(apellidos)) errores.push('Los apellidos son obligatorios.');
  else if (muyLargo(apellidos, 80)) errores.push('Los apellidos no pueden pasar de 80 caracteres.');
  if (!esTexto(email) || !esEmailValido(email)) errores.push('El correo no tiene un formato válido.');
  if (esNuevo || !vacio(password)) {
    if (!esPasswordSegura(password)) {
      errores.push('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
    }
  }
  if (!ROLES.includes(rol)) errores.push(`El rol debe ser uno de: ${ROLES.join(', ')}.`);
  return errores;
}

function validarResidente(datos, hoy = new Date()) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return ['Envíe los datos del residente.'];
  const errores = [];
  for (const [campo, max] of Object.entries(LIMITES)) {
    const v = datos[campo];
    if (v !== undefined && v !== null && typeof v !== 'string') errores.push(`El campo ${campo} debe ser texto.`);
    else if (muyLargo(v, max)) errores.push(`El campo ${campo} no puede pasar de ${max} caracteres.`);
  }
  const { nombres, apellidos, dpi, fecha_nacimiento: fechaNac, sexo, fecha_ingreso: fechaIng, tipo_sangre: sangre, estado } = datos;

  if (vacio(nombres)) errores.push('Los nombres son obligatorios.');
  if (vacio(apellidos)) errores.push('Los apellidos son obligatorios.');
  if (!vacio(dpi) && (!esTexto(dpi) || !esDpiValido(dpi))) errores.push('El DPI debe tener exactamente 13 dígitos.');

  if (vacio(fechaNac)) errores.push('La fecha de nacimiento es obligatoria.');
  else if (!esTexto(fechaNac) || !esFechaValida(fechaNac)) errores.push('La fecha de nacimiento no es válida (use AAAA-MM-DD).');
  else if (new Date(`${fechaNac}T00:00:00`) > hoy) errores.push('La fecha de nacimiento no puede ser futura.');
  else if (calcularEdad(fechaNac, hoy) < 60) errores.push('El residente debe tener 60 años o más.');
  else if (calcularEdad(fechaNac, hoy) > 120) errores.push('La fecha de nacimiento no es realista.');

  if (!['M', 'F'].includes(sexo)) errores.push('El sexo debe ser M o F.');

  if (!vacio(fechaIng)) {
    if (!esFechaValida(fechaIng)) errores.push('La fecha de ingreso no es válida (use AAAA-MM-DD).');
    else if (new Date(`${fechaIng}T00:00:00`) > hoy) errores.push('La fecha de ingreso no puede ser futura.');
    else if (esFechaValida(fechaNac) && fechaIng < fechaNac) errores.push('La fecha de ingreso no puede ser anterior a la fecha de nacimiento.');
  }
  if (!vacio(sangre) && !TIPOS_SANGRE.includes(sangre)) errores.push('El tipo de sangre no es válido.');
  if (!vacio(estado) && !ESTADOS_RESIDENTE.includes(estado)) errores.push('El estado no es válido.');
  return errores;
}

module.exports = {
  ROLES,
  LIMITES,
  idValido,
  ESTADOS_RESIDENTE,
  TIPOS_SANGRE,
  esEmailValido,
  esPasswordSegura,
  esDpiValido,
  esFechaValida,
  calcularEdad,
  validarLogin,
  validarUsuario,
  validarResidente,
};
