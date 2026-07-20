const mongoose = require('mongoose');
const { ApiError } = require('./errorHandler');

// Valida que req.params[paramName] sea un ObjectId de Mongo bien formado ANTES de
// llegar a la capa de servicios, para responder 400 en vez de un 500 por CastError.
function validarIdParam(paramName = 'id') {
  return (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
      return next(new ApiError(400, 'Identificador inválido'));
    }
    next();
  };
}

module.exports = { validarIdParam };
