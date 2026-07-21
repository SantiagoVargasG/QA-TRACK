const Reporte = require('../models/Reporte');
const { cargarCriterioConAcceso } = require('./acceso.service');

function reportePublico(reporte) {
  return {
    id: reporte._id,
    criterioId: reporte.criterioId,
    estadoCaso: reporte.estadoCaso,
    entradas: reporte.entradas,
    createdAt: reporte.createdAt,
  };
}

// Histórico inmutable: consultable aunque el criterio esté APROBADO/cerrado (PRD sección
// 6) — por eso usa el mismo cargarCriterioConAcceso que el resto de las operaciones de
// criterio, sin filtrar por estado.
async function listarPorCriterio(tenantId, criterioId, auth) {
  await cargarCriterioConAcceso(tenantId, criterioId, auth);
  const reportes = await Reporte.find({ tenantId, criterioId }).sort({ createdAt: 1 });
  return reportes.map(reportePublico);
}

module.exports = { listarPorCriterio };
