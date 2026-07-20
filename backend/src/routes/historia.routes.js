const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const historiaController = require('../controllers/historia.controller');

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

module.exports = router;
