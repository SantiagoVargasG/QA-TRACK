const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const { subirEvidencias } = require('../middleware/upload.middleware');
const criterioController = require('../controllers/criterio.controller');

const router = Router();

router.get(
  '/historias/:historiaId/criterios',
  requireAuth,
  validarIdParam('historiaId'),
  criterioController.listar,
);
router.post(
  '/historias/:historiaId/criterios',
  requireAuth,
  validarIdParam('historiaId'),
  criterioController.crear,
);
router.put(
  '/historias/:historiaId/criterios/:criterioId',
  requireAuth,
  validarIdParam('historiaId'),
  validarIdParam('criterioId'),
  criterioController.actualizar,
);
router.delete(
  '/historias/:historiaId/criterios/:criterioId',
  requireAuth,
  validarIdParam('historiaId'),
  validarIdParam('criterioId'),
  criterioController.eliminar,
);
router.post(
  '/criterios/:id/check',
  requireAuth,
  validarIdParam('id'),
  subirEvidencias,
  criterioController.aplicarCheck,
);

module.exports = router;
