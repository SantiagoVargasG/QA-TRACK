const requerimientoService = require('../services/requerimiento.service');

async function listar(req, res, next) {
  try {
    res.json(await requerimientoService.listar(req.auth.tenantId, req.params.moduloId, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res
      .status(201)
      .json(await requerimientoService.crear(req.auth.tenantId, req.params.moduloId, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(
      await requerimientoService.actualizar(
        req.auth.tenantId,
        req.params.moduloId,
        req.params.requerimientoId,
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
      await requerimientoService.eliminar(
        req.auth.tenantId,
        req.params.moduloId,
        req.params.requerimientoId,
        req.auth,
      ),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
