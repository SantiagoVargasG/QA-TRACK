const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const usuarioController = require('../controllers/usuario.controller');

const router = Router();

router.get('/usuarios', requireAuth, requireAdmin, usuarioController.listar);
router.post('/usuarios', requireAuth, requireAdmin, usuarioController.crear);
router.put('/usuarios/:id', requireAuth, requireAdmin, validarIdParam(), usuarioController.actualizar);
router.delete('/usuarios/:id', requireAuth, requireAdmin, validarIdParam(), usuarioController.eliminar);

module.exports = router;
