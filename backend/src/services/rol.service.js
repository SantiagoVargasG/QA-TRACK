const Rol = require('../models/Rol');
const Proyecto = require('../models/Proyecto');
const { ApiError } = require('../middleware/errorHandler');
const CAPACIDADES_VALIDAS = require('../config/capacidades');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const auditoriaService = require('./auditoria.service');

function rolPublico(rol) {
  return {
    id: rol._id,
    nombre: rol.nombre,
    capacidades: rol.capacidades,
    esSemilla: rol.esSemilla,
  };
}

function validarCapacidades(capacidades) {
  if (capacidades === undefined) return;
  if (!Array.isArray(capacidades)) {
    throw new ApiError(400, 'capacidades debe ser un arreglo');
  }
  const invalida = capacidades.find((c) => !CAPACIDADES_VALIDAS.includes(c));
  if (invalida) {
    throw new ApiError(400, `Capacidad inválida: ${invalida}`);
  }
}

async function listar(tenantId) {
  const roles = await Rol.find({ tenantId }).sort({ createdAt: 1 });
  return roles.map(rolPublico);
}

async function crear(tenantId, { nombre, capacidades }, usuarioId) {
  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  stringParaFiltro(nombre, 'nombre');
  validarLongitudMax(nombre, 'nombre', 50);
  validarCapacidades(capacidades);

  const existente = await Rol.findOne({ tenantId, nombre });
  if (existente) throw new ApiError(400, 'Ya existe un rol con ese nombre');

  const rol = await Rol.create({ tenantId, nombre, capacidades: capacidades || [], esSemilla: false });
  await auditoriaService.registrar(tenantId, 'rol', rol._id, 'rol_creado', usuarioId, `Rol "${rol.nombre}" creado`);
  return rolPublico(rol);
}

async function actualizar(tenantId, id, { nombre, capacidades }, usuarioId) {
  const rol = await Rol.findOne({ _id: id, tenantId });
  if (!rol) throw new ApiError(404, 'Rol no encontrado');

  validarCapacidades(capacidades);
  if (nombre !== undefined) {
    stringParaFiltro(nombre, 'nombre');
    validarLongitudMax(nombre, 'nombre', 50);
    rol.nombre = nombre;
  }
  if (capacidades !== undefined) rol.capacidades = capacidades;

  await rol.save();
  await auditoriaService.registrar(tenantId, 'rol', rol._id, 'rol_actualizado', usuarioId, `Rol "${rol.nombre}" actualizado`);
  return rolPublico(rol);
}

async function eliminar(tenantId, id, usuarioId) {
  const rol = await Rol.findOne({ _id: id, tenantId });
  if (!rol) throw new ApiError(404, 'Rol no encontrado');
  if (rol.esSemilla) throw new ApiError(400, 'No se puede eliminar un rol semilla');

  // Mongo no tiene integridad referencial: un rol puede estar asignado en el equipo o en
  // las columnas de check de un proyecto sin que nada lo impida a nivel de BD. Borrarlo sin
  // este guard dejaría esas referencias colgantes (equipo[].rolId / columnasCheck[].rolId
  // apuntando a un rol inexistente), rompiendo en silencio el acceso de ese miembro la
  // próxima vez que intente usar su capacidad — ver verificarCapacidadEnProyecto().
  const proyectosEnUso = await Proyecto.countDocuments({
    tenantId,
    activo: true,
    $or: [{ 'equipo.rolId': id }, { 'columnasCheck.rolId': id }],
  });
  if (proyectosEnUso > 0) {
    throw new ApiError(
      400,
      `No se puede eliminar: el rol está en uso en ${proyectosEnUso} proyecto(s). Reasigná esos miembros o columnas antes de eliminarlo.`,
    );
  }

  await rol.deleteOne();
  await auditoriaService.registrar(tenantId, 'rol', rol._id, 'rol_eliminado', usuarioId, `Rol "${rol.nombre}" eliminado`);
  return { id };
}

module.exports = { listar, crear, actualizar, eliminar };
