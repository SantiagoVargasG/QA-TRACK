const historiaService = require('../services/historia.service');

async function listar(req, res, next) {
  try {
    res.json(await historiaService.listar(req.auth.tenantId, req.params.requerimientoId, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res
      .status(201)
      .json(await historiaService.crear(req.auth.tenantId, req.params.requerimientoId, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(
      await historiaService.actualizar(
        req.auth.tenantId,
        req.params.requerimientoId,
        req.params.historiaId,
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
      await historiaService.eliminar(
        req.auth.tenantId,
        req.params.requerimientoId,
        req.params.historiaId,
        req.auth,
      ),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
