const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

const router = Router();

// Sin requireAdmin: cualquier usuario autenticado ve el resumen escopado a sus propios
// proyectos accesibles (mismo filtro que GET /proyectos), igual que el resto del árbol
// de contenido.
router.get('/dashboard', requireAuth, dashboardController.resumen);

module.exports = router;
