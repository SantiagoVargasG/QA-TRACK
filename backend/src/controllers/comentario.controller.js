const comentarioService = require('../services/comentario.service');
const { limpiarArchivos } = require('../utils/evidencias');

async function listar(req, res, next) {
  try {
    res.json(await comentarioService.listar(req.auth.tenantId, req.params.id, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await comentarioService.crear(req.auth.tenantId, req.params.id, req.auth, req.body, req.files),
      );
  } catch (err) {
    limpiarArchivos(req.files);
    next(err);
  }
}

module.exports = { listar, crear };
