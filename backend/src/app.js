const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const rolRoutes = require('./routes/rol.routes');
const proyectoRoutes = require('./routes/proyecto.routes');
const moduloRoutes = require('./routes/modulo.routes');
const requerimientoRoutes = require('./routes/requerimiento.routes');
const historiaRoutes = require('./routes/historia.routes');
const criterioRoutes = require('./routes/criterio.routes');
const reporteRoutes = require('./routes/reporte.routes');
const evidenciaRoutes = require('./routes/evidencia.routes');
const webhookRoutes = require('./routes/webhook.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', rolRoutes);
app.use('/api', proyectoRoutes);
app.use('/api', moduloRoutes);
app.use('/api', requerimientoRoutes);
app.use('/api', historiaRoutes);
app.use('/api', criterioRoutes);
app.use('/api', reporteRoutes);
app.use('/api', evidenciaRoutes);
app.use('/api', webhookRoutes);
app.use('/api', auditoriaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
