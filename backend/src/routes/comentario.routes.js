const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const { subirEvidencias } = require('../middleware/upload.middleware');
const comentarioController = require('../controllers/comentario.controller');

const router = Router();

router.get('/criterios/:id/comentarios', requireAuth, validarIdParam('id'), comentarioController.listar);
router.post(
  '/criterios/:id/comentarios',
  requireAuth,
  validarIdParam('id'),
  subirEvidencias,
  comentarioController.crear,
);

module.exports = router;
