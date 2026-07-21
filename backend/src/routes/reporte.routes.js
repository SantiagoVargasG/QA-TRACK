const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const reporteController = require('../controllers/reporte.controller');

const router = Router();

router.get('/criterios/:id/reportes', requireAuth, validarIdParam('id'), reporteController.listarPorCriterio);

module.exports = router;
