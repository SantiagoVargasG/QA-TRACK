const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const auditoriaController = require('../controllers/auditoria.controller');

const router = Router();

router.get('/auditoria', requireAuth, requireAdmin, auditoriaController.listar);

module.exports = router;
