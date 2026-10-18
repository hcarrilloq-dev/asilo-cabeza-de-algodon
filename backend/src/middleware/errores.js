function rutaNoEncontrada(req, res) {
  res.status(404).json({ mensaje: `La ruta ${req.method} ${req.originalUrl} no existe.` });
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  // Violación de UNIQUE en SQL Server (2627 / 2601)
  if (err && (err.number === 2627 || err.number === 2601)) {
    return res.status(409).json({ mensaje: 'Ya existe un registro con esos datos (dato duplicado).' });
  }
  console.error(err);
  return res.status(500).json({ mensaje: 'Ocurrió un error en el servidor. Intente de nuevo.' });
}

module.exports = { rutaNoEncontrada, manejadorErrores };
