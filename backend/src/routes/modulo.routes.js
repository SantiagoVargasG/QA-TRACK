const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const moduloController = require('../controllers/modulo.controller');

const router = Router();

router.get('/proyectos/:proyectoId/modulos', requireAuth, validarIdParam('proyectoId'), moduloController.listar);
router.post(
  '/proyectos/:proyectoId/modulos',
  requireAuth,
  validarIdParam('proyectoId'),
  moduloController.crear,
);
router.put(
  '/proyectos/:proyectoId/modulos/reordenar',
  requireAuth,
  validarIdParam('proyectoId'),
  moduloController.reordenar,
);
router.put(
  '/proyectos/:proyectoId/modulos/:moduloId',
  requireAuth,
  validarIdParam('proyectoId'),
  validarIdParam('moduloId'),
  moduloController.actualizar,
);
router.delete(
  '/proyectos/:proyectoId/modulos/:moduloId',
  requireAuth,
  validarIdParam('proyectoId'),
  validarIdParam('moduloId'),
  moduloController.eliminar,
);

module.exports = router;
