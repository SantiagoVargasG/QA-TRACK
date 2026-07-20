const { ApiError } = require('../middleware/errorHandler');
const Proyecto = require('../models/Proyecto');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Historia = require('../models/Historia');
const Rol = require('../models/Rol');

// Un usuario fuera del equipo del proyecto (y sin esAdmin) recibe 404, igual que un
// proyecto de otro tenant: no se revela su existencia (PRD 4.3, criterio de aceptación #8).
async function cargarProyectoConAcceso(tenantId, proyectoId, auth) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');

  if (!auth.esAdmin) {
    const esMiembro = proyecto.equipo.some((m) => m.usuarioId.toString() === auth.usuarioId);
    if (!esMiembro) throw new ApiError(404, 'Proyecto no encontrado');
  }

  return proyecto;
}

// A diferencia de la membresía (404), no tener la capacidad requerida SÍ se distingue con
// 403: el usuario ya sabe que el proyecto existe y que él es miembro, solo no puede hacer
// esta acción puntual.
async function verificarCapacidadEnProyecto(proyecto, auth, capacidad) {
  if (auth.esAdmin) return;

  const miembro = proyecto.equipo.find((m) => m.usuarioId.toString() === auth.usuarioId);
  if (!miembro) throw new ApiError(404, 'Proyecto no encontrado');

  const rol = await Rol.findOne({ _id: miembro.rolId, tenantId: proyecto.tenantId });
  if (!rol || !rol.capacidades.includes(capacidad)) {
    throw new ApiError(403, `Requiere la capacidad "${capacidad}" en este proyecto`);
  }
}

async function cargarModuloConAcceso(tenantId, moduloId, auth) {
  const modulo = await Modulo.findOne({ _id: moduloId, tenantId, activo: true });
  if (!modulo) throw new ApiError(404, 'Módulo no encontrado');

  const proyecto = await cargarProyectoConAcceso(tenantId, modulo.proyectoId, auth);
  return { modulo, proyecto };
}

async function cargarRequerimientoConAcceso(tenantId, requerimientoId, auth) {
  const requerimiento = await Requerimiento.findOne({ _id: requerimientoId, tenantId, activo: true });
  if (!requerimiento) throw new ApiError(404, 'Requerimiento no encontrado');

  const proyecto = await cargarProyectoConAcceso(tenantId, requerimiento.proyectoId, auth);
  return { requerimiento, proyecto };
}

async function cargarHistoriaConAcceso(tenantId, historiaId, auth) {
  const historia = await Historia.findOne({ _id: historiaId, tenantId, activo: true });
  if (!historia) throw new ApiError(404, 'Historia no encontrada');

  const proyecto = await cargarProyectoConAcceso(tenantId, historia.proyectoId, auth);
  return { historia, proyecto };
}

module.exports = {
  cargarProyectoConAcceso,
  verificarCapacidadEnProyecto,
  cargarModuloConAcceso,
  cargarRequerimientoConAcceso,
  cargarHistoriaConAcceso,
};
