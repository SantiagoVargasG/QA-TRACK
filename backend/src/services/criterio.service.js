const Criterio = require('../models/Criterio');
const Rol = require('../models/Rol');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const {
  verificarCapacidadEnProyecto,
  obtenerMiembroEquipo,
  cargarHistoriaConAcceso,
  cargarCriterioConAcceso,
} = require('./acceso.service');

// Acciones soportadas por tipo de columna. En esta iteración solo existe el camino feliz
// (finalizar/aprobar); rechazar/solucionar/cerrar_caso/reabrir llegan en la Iteración 4.
const ACCION_POR_TIPO_COLUMNA = { finalizado: 'finalizar', aprobacion: 'aprobar' };
const CAPACIDAD_POR_ACCION = { finalizar: 'marcar_finalizado', aprobar: 'aprobar_rechazar' };
const ESTADO_ORIGEN_POR_ACCION = { finalizar: 'PENDIENTE', aprobar: 'FINALIZADO_DEV' };
const ESTADO_DESTINO_POR_ACCION = { finalizar: 'FINALIZADO_DEV', aprobar: 'APROBADO' };

function criterioPublico(criterio) {
  return {
    id: criterio._id,
    historiaId: criterio.historiaId,
    texto: criterio.texto,
    orden: criterio.orden,
    estado: criterio.estado,
    checks: criterio.checks,
    activo: criterio.activo,
  };
}

async function listar(tenantId, historiaId, auth) {
  await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  const criterios = await Criterio.find({ tenantId, historiaId, activo: true }).sort({ orden: 1 });
  return criterios.map(criterioPublico);
}

async function crear(tenantId, historiaId, auth, { texto }) {
  const { historia, proyecto } = await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (!texto) throw new ApiError(400, 'texto es requerido');
  validarLongitudMax(texto, 'texto', 500);

  const ultimo = await Criterio.findOne({ tenantId, historiaId }).sort({ orden: -1 });
  const orden = ultimo ? ultimo.orden + 1 : 1;

  const criterio = await Criterio.create({
    tenantId,
    proyectoId: historia.proyectoId,
    historiaId,
    texto,
    orden,
  });
  return criterioPublico(criterio);
}

async function actualizar(tenantId, historiaId, criterioId, auth, { texto }) {
  const { criterio, proyecto } = await cargarCriterioConAcceso(tenantId, criterioId, auth);
  if (criterio.historiaId.toString() !== historiaId) throw new ApiError(404, 'Criterio no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (texto !== undefined) {
    validarLongitudMax(texto, 'texto', 500);
    criterio.texto = texto;
  }

  await criterio.save();
  return criterioPublico(criterio);
}

async function eliminar(tenantId, historiaId, criterioId, auth) {
  const { criterio, proyecto } = await cargarCriterioConAcceso(tenantId, criterioId, auth);
  if (criterio.historiaId.toString() !== historiaId) throw new ApiError(404, 'Criterio no encontrado');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  criterio.activo = false;
  await criterio.save();
  return criterioPublico(criterio);
}

// POST /criterios/:id/check — el corazón de la máquina de estados (PRD sección 6). Valida,
// en este orden: la columna existe en el proyecto, la acción corresponde al tipo de esa
// columna, el usuario tiene el rol asignado a esa columna (esAdmin lo puentea) y la
// capacidad requerida, y la transición de estado es válida desde el estado actual.
async function aplicarCheck(tenantId, criterioId, auth, { columna, accion }) {
  const { criterio, proyecto } = await cargarCriterioConAcceso(tenantId, criterioId, auth);

  stringParaFiltro(columna, 'columna');
  if (!columna) throw new ApiError(400, 'columna es requerida');
  if (!accion || !Object.values(ACCION_POR_TIPO_COLUMNA).includes(accion)) {
    throw new ApiError(400, `acción no soportada: ${accion}`);
  }

  const columnaDef = proyecto.columnasCheck.find((c) => c.nombre === columna);
  if (!columnaDef) throw new ApiError(400, `la columna "${columna}" no existe en este proyecto`);

  if (ACCION_POR_TIPO_COLUMNA[columnaDef.tipo] !== accion) {
    throw new ApiError(400, `la acción "${accion}" no es válida para una columna de tipo "${columnaDef.tipo}"`);
  }

  if (!auth.esAdmin) {
    const miembro = obtenerMiembroEquipo(proyecto, auth);
    if (!miembro || !columnaDef.rolId || columnaDef.rolId.toString() !== miembro.rolId.toString()) {
      throw new ApiError(403, `No tienes el rol asignado a la columna "${columna}" en este proyecto`);
    }

    const capacidadRequerida = CAPACIDAD_POR_ACCION[accion];
    const rol = await Rol.findOne({ _id: miembro.rolId, tenantId });
    if (!rol || !rol.capacidades.includes(capacidadRequerida)) {
      throw new ApiError(403, `Requiere la capacidad "${capacidadRequerida}" en este proyecto`);
    }
  }

  if (criterio.estado !== ESTADO_ORIGEN_POR_ACCION[accion]) {
    throw new ApiError(
      400,
      `no se puede "${accion}" un criterio en estado ${criterio.estado} (se esperaba ${ESTADO_ORIGEN_POR_ACCION[accion]})`,
    );
  }

  criterio.estado = ESTADO_DESTINO_POR_ACCION[accion];
  const valor = accion === 'finalizar' ? 'finalizado' : 'aprobado';
  const entrada = { columnaNombre: columna, valor, usuarioId: auth.usuarioId, fecha: new Date() };
  const idxExistente = criterio.checks.findIndex((c) => c.columnaNombre === columna);
  if (idxExistente >= 0) criterio.checks[idxExistente] = entrada;
  else criterio.checks.push(entrada);

  await criterio.save();
  return criterioPublico(criterio);
}

module.exports = { listar, crear, actualizar, eliminar, aplicarCheck };
