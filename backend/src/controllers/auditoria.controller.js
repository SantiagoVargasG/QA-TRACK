const auditoriaService = require('../services/auditoria.service');

async function listar(req, res, next) {
  try {
    res.json(await auditoriaService.listar(req.auth.tenantId));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar };
