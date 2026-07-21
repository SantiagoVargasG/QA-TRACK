const webhookService = require('../services/webhook.service');

async function listar(req, res, next) {
  try {
    res.json(await webhookService.listar(req.auth.tenantId, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await webhookService.crear(req.auth.tenantId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(await webhookService.actualizar(req.auth.tenantId, req.params.id, req.params.webhookId, req.body));
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    res.json(await webhookService.eliminar(req.auth.tenantId, req.params.id, req.params.webhookId));
  } catch (err) {
    next(err);
  }
}

async function reportarPrueba(req, res, next) {
  try {
    res.json(await webhookService.reportarPrueba(req.auth.tenantId, req.params.id, req.auth, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, crear, actualizar, eliminar, reportarPrueba };
