const moduloService = require('../services/modulo.service');

async function listar(req, res, next) {
  try {
    res.json(await moduloService.listar(req.auth.tenantId, req.params.proyectoId, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res
      .status(201)
      .json(await moduloService.crear(req.auth.tenantId, req.params.proyectoId, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(
      await moduloService.actualizar(
        req.auth.tenantId,
        req.params.proyectoId,
        req.params.moduloId,
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
      await moduloService.eliminar(req.auth.tenantId, req.params.proyectoId, req.params.moduloId, req.auth),
    );
  } catch (err) {
    next(err);
  }
}

async function reordenar(req, res, next) {
  try {
    res.json(await moduloService.reordenar(req.auth.tenantId, req.params.proyectoId, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar, reordenar };
