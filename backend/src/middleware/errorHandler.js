class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status;
  let mensaje = err.message;

  // Errores de Mongoose que no son ApiError: mapearlos a 400 en vez de dejarlos caer al
  // 500 genérico. Sin esto, un schema required/maxlength/enum fallido o un ObjectId
  // malformado en un campo que no pasa por validarIdParam responden 500 en vez de 400.
  if (!status && err.name === 'ValidationError') {
    status = 400;
    mensaje = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (!status && err.name === 'CastError') {
    status = 400;
    mensaje = 'Identificador o valor inválido';
  } else if (!status && err.code === 11000) {
    // Colisión de índice único (ej. codigo HU-N bajo concurrencia, email duplicado).
    // Los casos esperables ya se manejan aguas arriba (con reintento o un ApiError 400
    // explícito); este mapeo es una red de seguridad para que uno no controlado nunca
    // caiga al 500 genérico.
    status = 409;
    mensaje = 'El recurso ya existe o hay un conflicto de concurrencia; reintentá la operación';
  } else if (!status && err.name === 'MulterError') {
    // Límite de tamaño/cantidad de archivos excedido en la subida de evidencias.
    status = 400;
    mensaje = 'Error al subir el archivo: ' + err.message;
  }

  status = status || 500;

  if (status === 500) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(status).json({ error: mensaje });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
