/**
 * Funciones de validación reutilizables para las rutas del sistema.
 * Cada función devuelve un mensaje de error (texto) o null si el valor es válido.
 */
const vacio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function texto(valor, nombre, { obligatorio = false, max = 300 } = {}) {
  if (vacio(valor)) return obligatorio ? `${nombre} es obligatorio.` : null;
  if (typeof valor !== 'string') return `${nombre} debe ser texto.`;
  if (valor.trim().length > max) return `${nombre} no puede pasar de ${max} caracteres.`;
  return null;
}

/** Monto en quetzales: número mayor que 0 (o igual si permitirCero), máximo 2 decimales. */
function monto(valor, nombre = 'El monto', { permitirCero = false, maximo = 1000000 } = {}) {
  if (vacio(valor)) return `${nombre} es obligatorio.`;
  if (typeof valor !== 'number' && typeof valor !== 'string') return `${nombre} debe ser un número.`;
  const txt = String(valor).trim();
  if (!/^-?\d+(\.\d+)?$/.test(txt)) return `${nombre} debe ser un número.`;
  const n = Number(txt);
  if (permitirCero ? n < 0 : n <= 0) return `${nombre} debe ser mayor que ${permitirCero ? 'o igual a ' : ''}0.`;
  if (/\.\d{3,}$/.test(txt)) return `${nombre} no puede tener más de 2 decimales.`;
  if (n > maximo) return `${nombre} no puede ser mayor que ${maximo}.`;
  return null;
}

function porcentaje(valor, nombre = 'El descuento') {
  if (vacio(valor)) return null;
  const txt = String(valor).trim();
  if (!/^-?\d+(\.\d+)?$/.test(txt)) return `${nombre} debe ser un número.`;
  const n = Number(txt);
  if (n < 0 || n > 100) return `${nombre} debe estar entre 0 % y 100 %.`;
  if (/\.\d{3,}$/.test(txt)) return `${nombre} no puede tener más de 2 decimales.`;
  return null;
}

function entero(valor, nombre, { min = 1, max = 100000 } = {}) {
  if (vacio(valor)) return `${nombre} es obligatorio.`;
  const n = Number(valor);
  if (!Number.isInteger(n) || String(valor).includes('.')) return `${nombre} debe ser un número entero.`;
  if (n < min || n > max) return `${nombre} debe estar entre ${min} y ${max}.`;
  return null;
}

function id(valor, nombre) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? null : `${nombre} no es válido.`;
}

/** Fecha AAAA-MM-DD existente. */
function fecha(valor, nombre, { obligatorio = true } = {}) {
  if (vacio(valor)) return obligatorio ? `${nombre} es obligatoria.` : null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${nombre} no es válida (use AAAA-MM-DD).`;
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return `${nombre} no es válida.`;
  return null;
}

/** Fecha y hora AAAA-MM-DDTHH:MM (como la envía un campo datetime-local). */
function fechaHora(valor, nombre) {
  if (vacio(valor)) return `${nombre} es obligatoria.`;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor)) return `${nombre} no es válida.`;
  const err = fecha(valor.slice(0, 10), nombre);
  if (err) return err;
  const [h, m] = valor.slice(11, 16).split(':').map(Number);
  if (h > 23 || m > 59) return `${nombre} no es válida.`;
  return null;
}

function opcion(valor, nombre, opciones) {
  return opciones.includes(valor) ? null : `${nombre} debe ser uno de: ${opciones.join(', ')}.`;
}

function telefono(valor, { obligatorio = true } = {}) {
  if (vacio(valor)) return obligatorio ? 'El teléfono es obligatorio.' : null;
  return typeof valor === 'string' && /^\d{8}$/.test(valor.trim()) ? null : 'El teléfono debe tener 8 dígitos.';
}

function email(valor, { obligatorio = false } = {}) {
  if (vacio(valor)) return obligatorio ? 'El correo es obligatorio.' : null;
  return typeof valor === 'string' && valor.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
    ? null : 'El correo no tiene un formato válido.';
}

/** Junta los errores (ignora los null) */
const juntar = (...lista) => lista.filter(Boolean);

/** Responde 400 si hay errores. Devuelve true si respondió. */
function responderErrores(res, errores) {
  if (errores.length) {
    res.status(400).json({ mensaje: errores[0], errores });
    return true;
  }
  return false;
}

const limpio = (v) => (vacio(v) ? null : String(v).trim());

module.exports = {
  vacio, texto, monto, porcentaje, entero, id, fecha, fechaHora, opcion, telefono, email,
  juntar, responderErrores, limpio,
};
