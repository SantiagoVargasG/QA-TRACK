const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const evidenciaController = require('../controllers/evidencia.controller');

const router = Router();

router.get('/uploads/:archivo', requireAuth, evidenciaController.servir);

module.exports = router;
