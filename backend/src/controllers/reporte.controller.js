const reporteService = require('../services/reporte.service');

async function listarPorCriterio(req, res, next) {
  try {
    res.json(await reporteService.listarPorCriterio(req.auth.tenantId, req.params.id, req.auth));
  } catch (err) {
    next(err);
  }
}

module.exports = { listarPorCriterio };
