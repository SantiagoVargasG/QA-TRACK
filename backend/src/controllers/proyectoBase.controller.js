const proyectoBaseService = require('../services/proyectoBase.service');

async function listar(req, res, next) {
  try {
    res.json(await proyectoBaseService.listar(req.auth.tenantId));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await proyectoBaseService.crear(req.auth.tenantId, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(await proyectoBaseService.actualizar(req.auth.tenantId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    res.json(await proyectoBaseService.eliminar(req.auth.tenantId, req.params.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar };
