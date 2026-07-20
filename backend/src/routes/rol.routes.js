const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { validarIdParam } = require('../middleware/validateObjectId');
const rolController = require('../controllers/rol.controller');

const router = Router();

router.get('/roles', requireAuth, requireAdmin, rolController.listar);
router.post('/roles', requireAuth, requireAdmin, rolController.crear);
router.put('/roles/:id', requireAuth, requireAdmin, validarIdParam(), rolController.actualizar);
router.delete('/roles/:id', requireAuth, requireAdmin, validarIdParam(), rolController.eliminar);

module.exports = router;
