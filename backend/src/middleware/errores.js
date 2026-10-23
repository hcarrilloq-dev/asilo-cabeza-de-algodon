function rutaNoEncontrada(req, res) {
  res.status(404).json({ mensaje: `La ruta ${req.method} ${req.originalUrl} no existe.` });
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  // Errores de negocio lanzados con fallo(status, mensaje)
  if (err && err.esFallo) {
    return res.status(err.status).json({ mensaje: err.message });
  }
  // Cuerpo de la petición que no es JSON válido
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'La información enviada es demasiado grande.' });
  }
  // Violación de UNIQUE en SQL Server (2627 / 2601)
  if (err && (err.number === 2627 || err.number === 2601)) {
    return res.status(409).json({ mensaje: 'Ya existe un registro con esos datos (dato duplicado).' });
  }
  // Violación de CHECK o de llave foránea (547): datos que no cumplen las reglas
  if (err && err.number === 547) {
    return res.status(400).json({ mensaje: 'Los datos no cumplen las reglas del sistema o hacen referencia a un registro inexistente.' });
  }
  // Fecha u otro dato que SQL Server no pudo convertir (241, 242, 245, 8114)
  if (err && [241, 242, 245, 8114].includes(err.number)) {
    return res.status(400).json({ mensaje: 'Uno de los datos no tiene el formato correcto. Revise las fechas y los montos.' });
  }
  console.error(err);
  return res.status(500).json({
    mensaje: 'No se pudo completar la operación por un error del servidor. Sus datos no se guardaron; intente de nuevo y, si el problema continúa, avise al administrador.',
  });
}

module.exports = { rutaNoEncontrada, manejadorErrores };
