const { ApiError } = require('./errorHandler');
const { verificarToken } = require('../services/token.service');
const Usuario = require('../models/Usuario');

// El JWT solo prueba identidad (quién dice ser, en qué tenant se autenticó); NUNCA es
// la fuente de verdad de sus permisos actuales. Cada request vuelve a consultar el
// usuario en BD para que una desactivación o un cambio de esAdmin surta efecto de
// inmediato, en vez de esperar a que el token expire (ver auditoría de seguridad,
// Iteración 1).
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Token no proporcionado'));
  }

  const token = header.slice('Bearer '.length);
  let payload;
  try {
    payload = verificarToken(token);
  } catch (err) {
    return next(new ApiError(401, 'Token inválido o expirado'));
  }

  try {
    const usuario = await Usuario.findById(payload.usuarioId).select('tenantId esAdmin activo').lean();
    if (!usuario || !usuario.activo || usuario.tenantId.toString() !== payload.tenantId) {
      return next(new ApiError(401, 'Sesión inválida'));
    }
    req.auth = {
      tenantId: usuario.tenantId.toString(),
      usuarioId: payload.usuarioId,
      esAdmin: usuario.esAdmin,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth?.esAdmin) {
    return next(new ApiError(403, 'Requiere permisos de administrador'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
