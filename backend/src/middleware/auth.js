const jwt = require('jsonwebtoken');

/** Verifica que la petición traiga un token válido: Authorization: Bearer <token> */
function verificarToken(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Debe iniciar sesión para continuar.' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ mensaje: 'La sesión expiró o no es válida. Inicie sesión de nuevo.' });
  }
}

/** Permite el acceso solo a los roles indicados. Se usa después de verificarToken. */
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tiene permiso para realizar esta acción.' });
    }
    return next();
  };
}

module.exports = { verificarToken, permitirRoles };
