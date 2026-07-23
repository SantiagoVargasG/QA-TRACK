const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const historiaController = require('../controllers/historia.controller');
const webhookController = require('../controllers/webhook.controller');

const router = Router();

router.get(
  '/requerimientos/:requerimientoId/historias',
  requireAuth,
  validarIdParam('requerimientoId'),
  historiaController.listar,
);
router.post(
  '/requerimientos/:requerimientoId/historias',
  requireAuth,
  validarIdParam('requerimientoId'),
  historiaController.crear,
);
router.put(
  '/requerimientos/:requerimientoId/historias/:historiaId',
  requireAuth,
  validarIdParam('requerimientoId'),
  validarIdParam('historiaId'),
  historiaController.actualizar,
);
router.delete(
  '/requerimientos/:requerimientoId/historias/:historiaId',
  requireAuth,
  validarIdParam('requerimientoId'),
  validarIdParam('historiaId'),
  historiaController.eliminar,
);

// Acción manual "Enviar a webhook" (capacidad aprobar_rechazar, ver
// webhookService.reportarHistoria) — no requiere requerimientoId en la ruta porque el
// historiaId ya resuelve el proyecto vía cargarHistoriaConAcceso.
router.post(
  '/historias/:historiaId/reportar-webhook',
  requireAuth,
  validarIdParam('historiaId'),
  webhookController.reportarHistoria,
);

module.exports = router;
