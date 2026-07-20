const usuarioService = require('../services/usuario.service');

async function listar(req, res, next) {
  try {
    res.json(await usuarioService.listar(req.auth.tenantId));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await usuarioService.crear(req.auth.tenantId, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(await usuarioService.actualizar(req.auth.tenantId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    res.json(await usuarioService.eliminar(req.auth.tenantId, req.params.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
