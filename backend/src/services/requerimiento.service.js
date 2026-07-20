const Requerimiento = require('../models/Requerimiento');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax } = require('../utils/validacion');
const {
  verificarCapacidadEnProyecto,
  cargarModuloConAcceso,
  cargarRequerimientoConAcceso,
} = require('./acceso.service');

function requerimientoPublico(req) {
  return {
    id: req._id,
    moduloId: req.moduloId,
    titulo: req.titulo,
    descripcionResumida: req.descripcionResumida,
    descripcionExtendida: req.descripcionExtendida,
    orden: req.orden,
    createdBy: req.createdBy,
    activo: req.activo,
  };
}

async function listar(tenantId, moduloId, auth) {
  await cargarModuloConAcceso(tenantId, moduloId, auth);
  const requerimientos = await Requerimiento.find({ tenantId, moduloId, activo: true }).sort({ orden: 1 });
  return requerimientos.map(requerimientoPublico);
}

async function crear(tenantId, moduloId, auth, { titulo, descripcionResumida, descripcionExtendida }) {
  const { modulo, proyecto } = await cargarModuloConAcceso(tenantId, moduloId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (!titulo || !descripcionResumida) {
    throw new ApiError(400, 'titulo y descripcionResumida son requeridos');
  }
  validarLongitudMax(titulo, 'titulo', 150);
  validarLongitudMax(descripcionResumida, 'descripcionResumida', 500);
  if (descripcionExtendida !== undefined) {
    validarLongitudMax(descripcionExtendida, 'descripcionExtendida', 5000);
  }

  const ultimo = await Requerimiento.findOne({ tenantId, moduloId }).sort({ orden: -1 });
  const orden = ultimo ? ultimo.orden + 1 : 1;

  const requerimiento = await Requerimiento.create({
    tenantId,
    proyectoId: modulo.proyectoId,
    moduloId,
    titulo,
    descripcionResumida,
    descripcionExtendida: descripcionExtendida || '',
    orden,
    createdBy: auth.usuarioId,
  });
  return requerimientoPublico(requerimiento);
}

async function actualizar(tenantId, moduloId, requerimientoId, auth, { titulo, descripcionResumida, descripcionExtendida }) {
  const { requerimiento, proyecto } = await cargarRequerimientoConAcceso(tenantId, requerimientoId, auth);
  if (requerimiento.moduloId.toString() !== moduloId) throw new ApiError(404, 'Requerimiento no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (titulo !== undefined) {
    validarLongitudMax(titulo, 'titulo', 150);
    requerimiento.titulo = titulo;
  }
  if (descripcionResumida !== undefined) {
    validarLongitudMax(descripcionResumida, 'descripcionResumida', 500);
    requerimiento.descripcionResumida = descripcionResumida;
  }
  if (descripcionExtendida !== undefined) {
    validarLongitudMax(descripcionExtendida, 'descripcionExtendida', 5000);
    requerimiento.descripcionExtendida = descripcionExtendida;
  }

  await requerimiento.save();
  return requerimientoPublico(requerimiento);
}

async function eliminar(tenantId, moduloId, requerimientoId, auth) {
  const { requerimiento, proyecto } = await cargarRequerimientoConAcceso(tenantId, requerimientoId, auth);
  if (requerimiento.moduloId.toString() !== moduloId) throw new ApiError(404, 'Requerimiento no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  requerimiento.activo = false;
  await requerimiento.save();
  return requerimientoPublico(requerimiento);
}

module.exports = { listar, crear, actualizar, eliminar };
