const criterioService = require('../services/criterio.service');
const { limpiarArchivos } = require('../utils/evidencias');

async function listar(req, res, next) {
  try {
    res.json(await criterioService.listar(req.auth.tenantId, req.params.historiaId, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res
      .status(201)
      .json(await criterioService.crear(req.auth.tenantId, req.params.historiaId, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(
      await criterioService.actualizar(
        req.auth.tenantId,
        req.params.historiaId,
        req.params.criterioId,
        req.auth,
        req.body,
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    res.json(
      await criterioService.eliminar(
        req.auth.tenantId,
        req.params.historiaId,
        req.params.criterioId,
        req.auth,
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function aplicarCheck(req, res, next) {
  try {
    res.json(
      await criterioService.aplicarCheck(req.auth.tenantId, req.params.id, req.auth, req.body, req.files),
    );
  } catch (err) {
    limpiarArchivos(req.files);
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar, aplicarCheck };
