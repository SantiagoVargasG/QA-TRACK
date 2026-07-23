const dashboardService = require('../services/dashboard.service');

async function resumen(req, res, next) {
  try {
    res.json(await dashboardService.resumen(req.auth.tenantId, req.auth));
  } catch (err) {
    next(err);
  }
}

module.exports = { resumen };
