const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const requerimientoController = require('../controllers/requerimiento.controller');

const router = Router();

router.get(
  '/modulos/:moduloId/requerimientos',
  requireAuth,
  validarIdParam('moduloId'),
  requerimientoController.listar,
);
router.post(
  '/modulos/:moduloId/requerimientos',
  requireAuth,
  validarIdParam('moduloId'),
  requerimientoController.crear,
);
router.put(
  '/modulos/:moduloId/requerimientos/:requerimientoId',
  requireAuth,
  validarIdParam('moduloId'),
  validarIdParam('requerimientoId'),
  requerimientoController.actualizar,
);
router.delete(
  '/modulos/:moduloId/requerimientos/:requerimientoId',
  requireAuth,
  validarIdParam('moduloId'),
  validarIdParam('requerimientoId'),
  requerimientoController.eliminar,
);

module.exports = router;
