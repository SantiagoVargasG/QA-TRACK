const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const proyectoController = require('../controllers/proyecto.controller');

const router = Router();

router.get('/proyectos', requireAuth, proyectoController.listar);
router.post('/proyectos', requireAuth, requireAdmin, proyectoController.crear);
router.get('/proyectos/:id', requireAuth, validarIdParam(), proyectoController.obtener);
router.get('/proyectos/:id/miembros', requireAuth, validarIdParam(), proyectoController.miembros);
router.put('/proyectos/:id', requireAuth, requireAdmin, validarIdParam(), proyectoController.actualizar);
router.delete('/proyectos/:id', requireAuth, requireAdmin, validarIdParam(), proyectoController.eliminar);
router.put(
  '/proyectos/:id/equipo',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  proyectoController.actualizarEquipo,
);
router.put(
  '/proyectos/:id/columnas-check',
  requireAuth,
  requireAdmin,
  validarIdParam(),
  proyectoController.actualizarColumnasCheck,
);

module.exports = router;
