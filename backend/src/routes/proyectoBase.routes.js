const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const proyectoBaseController = require('../controllers/proyectoBase.controller');

const router = Router();

router.get('/proyectos-base', requireAuth, requireAdmin, proyectoBaseController.listar);
router.post('/proyectos-base', requireAuth, requireAdmin, proyectoBaseController.crear);
router.put(
  '/proyectos-base/:id',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  proyectoBaseController.actualizar,
);
router.delete(
  '/proyectos-base/:id',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  proyectoBaseController.eliminar,
);

module.exports = router;
