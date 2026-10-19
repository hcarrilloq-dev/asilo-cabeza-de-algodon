const { idValido } = require('../validators/validaciones');

/** Valida el parámetro :nombre de la ruta y lo deja en req.ids[nombre] */
function paramId(router, nombre) {
  router.param(nombre, (req, res, next, valor) => {
    const n = idValido(valor);
    if (!n) return res.status(400).json({ mensaje: 'El identificador no es válido.' });
    req.ids = { ...(req.ids || {}), [nombre]: n };
    return next();
  });
}

/** Envuelve un controlador async para que cualquier error llegue al manejador de errores */
const manejar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Crea un error de negocio que el manejador responde con el status y mensaje indicados. */
function fallo(status, mensaje) {
  const e = new Error(mensaje);
  e.status = status;
  e.esFallo = true;
  return e;
}

module.exports = { paramId, manejar, fallo };
