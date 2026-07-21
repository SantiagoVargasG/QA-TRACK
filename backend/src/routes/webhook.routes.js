const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const webhookController = require('../controllers/webhook.controller');

const router = Router();

// CRUD de webhooks: nivel tenant, requiere esAdmin (PRD 7.1) — mismo patrón que
// /proyectos/:id/equipo y /proyectos/:id/columnas-check.
router.get('/proyectos/:id/webhooks', requireAuth, requireAdmin, validarIdParam(), webhookController.listar);
router.post('/proyectos/:id/webhooks', requireAuth, requireAdmin, validarIdParam(), webhookController.crear);
router.put(
  '/proyectos/:id/webhooks/:webhookId',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  validarIdParam('webhookId'),
  webhookController.actualizar,
);
router.delete(
  '/proyectos/:id/webhooks/:webhookId',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  validarIdParam('webhookId'),
  webhookController.eliminar,
);

// Reportar prueba: capacidad aprobar_rechazar en el proyecto (no esAdmin), ver
// verificarCapacidadEnProyecto dentro de webhookService.reportarPrueba.
router.post(
  '/proyectos/:id/reportar-prueba',
  requireAuth,
  validarIdParam(),
  webhookController.reportarPrueba,
);

module.exports = router;
