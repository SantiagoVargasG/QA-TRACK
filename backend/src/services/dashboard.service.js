const { Types } = require('mongoose');
const Proyecto = require('../models/Proyecto');
const Historia = require('../models/Historia');
const Criterio = require('../models/Criterio');
const Reporte = require('../models/Reporte');

// Agregado de solo-lectura para la pantalla de Inicio: KPIs a nivel tenant (escopados a
// los proyectos accesibles del usuario, mismo filtro que proyectoService.listar) más un
// resumen por proyecto (HUs, criterios por estado, progreso). Un único endpoint evita que
// el frontend dispare N requests (una por proyecto) para armar las tarjetas de Inicio.
async function resumen(tenantId, auth) {
  const filtroProyectos = auth.esAdmin
    ? { tenantId, activo: true }
    : { tenantId, activo: true, 'equipo.usuarioId': auth.usuarioId };
  const proyectos = await Proyecto.find(filtroProyectos).sort({ createdAt: 1 });
  const proyectoIds = proyectos.map((p) => p._id);

  // aggregate() no pasa por el casting automático de Mongoose (a diferencia de find()):
  // hay que convertir tenantId a ObjectId a mano o el $match nunca matchea nada.
  const tenantObjectId = new Types.ObjectId(tenantId);

  const [historiasPorProyecto, criterios] = await Promise.all([
    Historia.aggregate([
      { $match: { tenantId: tenantObjectId, proyectoId: { $in: proyectoIds }, activo: true } },
      { $group: { _id: '$proyectoId', total: { $sum: 1 } } },
    ]),
    Criterio.find({ tenantId, proyectoId: { $in: proyectoIds }, activo: true }, 'proyectoId estado').lean(),
  ]);

  const historiasPorProyectoId = new Map(historiasPorProyecto.map((h) => [h._id.toString(), h.total]));

  // Solo se consulta Reporte para los criterios ya APROBADOS (subconjunto chico): un
  // criterio aprobado que nunca tuvo un Reporte se aprobó a la primera, sin ciclos de
  // rechazo/solución de por medio.
  const criterioIdsAprobados = criterios.filter((c) => c.estado === 'APROBADO').map((c) => c._id);
  const reportesDeAprobados = await Reporte.find(
    { tenantId, criterioId: { $in: criterioIdsAprobados } },
    'criterioId',
  ).lean();
  const criterioIdsConReporte = new Set(reportesDeAprobados.map((r) => r.criterioId.toString()));

  const statsPorProyectoId = new Map();
  for (const p of proyectos) {
    statsPorProyectoId.set(p._id.toString(), { total: 0, aprobados: 0 });
  }

  let criteriosPendientesQA = 0;
  let criteriosRechazadosAbiertos = 0;
  let totalAprobados = 0;
  let aprobadosPrimeraVez = 0;

  for (const c of criterios) {
    const stats = statsPorProyectoId.get(c.proyectoId.toString());
    if (stats) stats.total += 1;

    if (c.estado === 'FINALIZADO_DEV') criteriosPendientesQA += 1;
    else if (c.estado === 'RECHAZADO') criteriosRechazadosAbiertos += 1;
    else if (c.estado === 'APROBADO') {
      totalAprobados += 1;
      if (stats) stats.aprobados += 1;
      if (!criterioIdsConReporte.has(c._id.toString())) aprobadosPrimeraVez += 1;
    }
  }

  const porcentajeAprobadoPrimeraVez =
    totalAprobados > 0 ? Math.round((aprobadosPrimeraVez / totalAprobados) * 100) : null;

  return {
    totalProyectos: proyectos.length,
    criteriosPendientesQA,
    criteriosRechazadosAbiertos,
    porcentajeAprobadoPrimeraVez,
    proyectos: proyectos.map((p) => {
      const stats = statsPorProyectoId.get(p._id.toString());
      return {
        id: p._id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        totalIntegrantes: p.equipo.length,
        totalHistorias: historiasPorProyectoId.get(p._id.toString()) || 0,
        criteriosTotal: stats.total,
        criteriosAprobados: stats.aprobados,
        progresoAprobados: stats.total > 0 ? Math.round((stats.aprobados / stats.total) * 100) : 0,
      };
    }),
  };
}

module.exports = { resumen };
