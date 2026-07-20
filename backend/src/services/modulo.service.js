const Modulo = require('../models/Modulo');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const ICONOS_VALIDOS = require('../config/iconosModulo');
const {
  cargarProyectoConAcceso,
  verificarCapacidadEnProyecto,
  cargarModuloConAcceso,
} = require('./acceso.service');

function moduloPublico(modulo) {
  return {
    id: modulo._id,
    proyectoId: modulo.proyectoId,
    nombre: modulo.nombre,
    icono: modulo.icono,
    descripcion: modulo.descripcion,
    orden: modulo.orden,
    activo: modulo.activo,
  };
}

function validarIcono(icono) {
  if (icono !== undefined && !ICONOS_VALIDOS.includes(icono)) {
    throw new ApiError(400, `icono inválido: ${icono}`);
  }
}

async function listar(tenantId, proyectoId, auth) {
  await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  const modulos = await Modulo.find({ tenantId, proyectoId, activo: true }).sort({ orden: 1 });
  return modulos.map(moduloPublico);
}

async function crear(tenantId, proyectoId, auth, { nombre, icono, descripcion }) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  validarLongitudMax(nombre, 'nombre', 100);
  validarIcono(icono);
  if (descripcion !== undefined) validarLongitudMax(descripcion, 'descripcion', 300);

  const ultimo = await Modulo.findOne({ tenantId, proyectoId }).sort({ orden: -1 });
  const orden = ultimo ? ultimo.orden + 1 : 1;

  const modulo = await Modulo.create({
    tenantId,
    proyectoId,
    nombre,
    icono: icono || 'carpeta',
    descripcion: descripcion || '',
    orden,
  });
  return moduloPublico(modulo);
}

async function actualizar(tenantId, proyectoId, moduloId, auth, { nombre, icono, descripcion }) {
  const { modulo, proyecto } = await cargarModuloConAcceso(tenantId, moduloId, auth);
  if (modulo.proyectoId.toString() !== proyectoId) throw new ApiError(404, 'Módulo no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (nombre !== undefined) {
    validarLongitudMax(nombre, 'nombre', 100);
    modulo.nombre = nombre;
  }
  if (icono !== undefined) {
    validarIcono(icono);
    modulo.icono = icono;
  }
  if (descripcion !== undefined) {
    validarLongitudMax(descripcion, 'descripcion', 300);
    modulo.descripcion = descripcion;
  }

  await modulo.save();
  return moduloPublico(modulo);
}

async function eliminar(tenantId, proyectoId, moduloId, auth) {
  const { modulo, proyecto } = await cargarModuloConAcceso(tenantId, moduloId, auth);
  if (modulo.proyectoId.toString() !== proyectoId) throw new ApiError(404, 'Módulo no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  modulo.activo = false;
  await modulo.save();
  return moduloPublico(modulo);
}

async function reordenar(tenantId, proyectoId, auth, { ids }) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'ids debe ser un arreglo con al menos un elemento');
  }
  ids.forEach((id) => stringParaFiltro(id, 'ids'));

  const modulos = await Modulo.find({ tenantId, proyectoId, activo: true });
  const idsExistentes = modulos.map((m) => m._id.toString());
  const esMismoConjunto =
    modulos.length === ids.length && idsExistentes.every((id) => ids.includes(id));
  if (!esMismoConjunto) {
    throw new ApiError(400, 'ids debe incluir exactamente todos los módulos activos del proyecto');
  }

  await Promise.all(
    ids.map((id, index) => Modulo.updateOne({ _id: id, tenantId, proyectoId }, { orden: index + 1 })),
  );

  const actualizados = await Modulo.find({ tenantId, proyectoId, activo: true }).sort({ orden: 1 });
  return actualizados.map(moduloPublico);
}

module.exports = { listar, crear, actualizar, eliminar, reordenar };
