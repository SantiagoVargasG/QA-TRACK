const Criterio = require('../models/Criterio');
const Reporte = require('../models/Reporte');
const Rol = require('../models/Rol');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const { validarYMapearEvidencias } = require('../utils/evidencias');
const {
  verificarCapacidadEnProyecto,
  obtenerMiembroEquipo,
  cargarHistoriaConAcceso,
  cargarCriterioConAcceso,
} = require('./acceso.service');
const auditoriaService = require('./auditoria.service');

// Máquina de estados completa (PRD sección 6). Cada acción declara: a qué tipo de columna
// corresponde, qué capacidad requiere, desde qué estado(s) de origen es válida, a qué
// estado destino lleva, qué valor queda en `checks` para esa columna, y qué tipo de
// entrada registra en el histórico de `reportes` (null si la acción no genera reporte —
// solo el camino feliz finalizar/aprobar no lo genera).
// Decisión post-MVP: estas acciones YA NO disparan webhooks por sí solas (antes cada
// aprobar/rechazar/solucionar/cerrar_caso mandaba un evento individual, generando demasiado
// ruido). El envío es ahora una acción manual por Historia de Usuario — ver
// webhookService.reportarHistoria() y el botón "Enviar a webhook" del frontend.
const ACCIONES = {
  finalizar: {
    tipoColumna: 'finalizado',
    capacidad: 'marcar_finalizado',
    origenes: ['PENDIENTE'],
    destino: 'FINALIZADO_DEV',
    valorCheck: 'finalizado',
    entradaTipo: null,
    comentarioRequerido: false,
  },
  aprobar: {
    tipoColumna: 'aprobacion',
    capacidad: 'aprobar_rechazar',
    origenes: ['FINALIZADO_DEV'],
    destino: 'APROBADO',
    valorCheck: 'aprobado',
    entradaTipo: null,
    comentarioRequerido: false,
  },
  // Rechazar tiene dos orígenes posibles: la primera vez (FINALIZADO_DEV, abre un caso
  // nuevo) o tras un ciclo de solución (SOLUCIONADO, reabre el mismo caso) — ver
  // registrarEntradaReporte().
  rechazar: {
    tipoColumna: 'aprobacion',
    capacidad: 'aprobar_rechazar',
    origenes: ['FINALIZADO_DEV', 'SOLUCIONADO'],
    destino: 'RECHAZADO',
    valorCheck: 'rechazado',
    entradaTipo: 'rechazo',
    comentarioRequerido: true,
  },
  solucionar: {
    tipoColumna: 'finalizado',
    capacidad: 'marcar_finalizado',
    origenes: ['RECHAZADO'],
    destino: 'SOLUCIONADO',
    valorCheck: 'solucionado',
    entradaTipo: 'solucion',
    comentarioRequerido: false,
  },
  cerrar_caso: {
    tipoColumna: 'aprobacion',
    capacidad: 'aprobar_rechazar',
    origenes: ['SOLUCIONADO'],
    destino: 'APROBADO',
    valorCheck: 'aprobado',
    entradaTipo: 'cierre',
    comentarioRequerido: false,
  },
  reabrir: {
    tipoColumna: 'aprobacion',
    capacidad: 'aprobar_rechazar',
    origenes: ['APROBADO'],
    destino: 'RECHAZADO',
    valorCheck: 'rechazado',
    entradaTipo: 'reapertura',
    comentarioRequerido: false,
  },
};

const ACCIONES_POR_TIPO_COLUMNA = Object.entries(ACCIONES).reduce((acc, [accion, cfg]) => {
  (acc[cfg.tipoColumna] ||= []).push(accion);
  return acc;
}, {});

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

// Único lugar donde se calcula "¿el usuario tiene el rol asignado a esta columna?" — tanto
// permisoColumnaSync() como evaluarPermisoColumna() delegan acá en vez de recalcularlo cada
// una por su cuenta, para que un cambio futuro en la regla no pueda divergir entre las dos.
function tieneRolAsignadoColumna(miembro, columnaDef) {
  return !!miembro && !!columnaDef.rolId && columnaDef.rolId.toString() === miembro.rolId.toString();
}

// Regla única de "¿puede este usuario actuar sobre esta columna?": tiene el rol asignado a
// la columna en el equipo del proyecto Y ese rol tiene la capacidad requerida; esAdmin
// puentea el chequeo (queda marcado porAdmin). Pura (no consulta la BD) para poder
// evaluarla repetidas veces con el rol ya resuelto una sola vez — ver evaluarPermisoColumna()
// (una consulta por request, usada por aplicarCheck) y listar() (una consulta por listado,
// reutilizada para todos los criterios y columnas candidatas).
function permisoColumnaSync(auth, miembro, rol, columnaDef, capacidad) {
  const tieneRolAsignado = tieneRolAsignadoColumna(miembro, columnaDef);

  if (auth.esAdmin) return { puede: true, porAdmin: !tieneRolAsignado, razon: null };
  if (!tieneRolAsignado) return { puede: false, porAdmin: false, razon: 'sin_rol' };
  if (!rol || !rol.capacidades.includes(capacidad)) return { puede: false, porAdmin: false, razon: 'sin_capacidad' };
  return { puede: true, porAdmin: false, razon: null };
}

// Punto de entrada usado por aplicarCheck(): resuelve el rol del usuario en este proyecto
// (solo si hace falta, mismo condicional que antes de extraer esto) y delega en
// permisoColumnaSync(). Única fuente de verdad de la regla de permisos por columna — no se
// duplica en ningún otro lugar del backend ni del frontend (ver calcularAccionesPermitidas,
// que la reutiliza para el hint de solo lectura en listar()).
async function evaluarPermisoColumna(tenantId, proyecto, auth, columnaDef, capacidad) {
  const miembro = obtenerMiembroEquipo(proyecto, auth);
  if (auth.esAdmin || !tieneRolAsignadoColumna(miembro, columnaDef)) {
    return permisoColumnaSync(auth, miembro, null, columnaDef, capacidad);
  }

  const rol = await Rol.findOne({ _id: miembro.rolId, tenantId });
  return permisoColumnaSync(auth, miembro, rol, columnaDef, capacidad);
}

// Solo lectura: qué transiciones puede ejecutar el usuario autenticado sobre un criterio en
// su estado actual, para que el frontend no tenga que adivinar ni duplicar la regla de
// permisos (ver selector de estado en ModuloDetallePage.jsx). La validación real sigue
// ocurriendo en aplicarCheck() en el momento del clic — esto nunca la reemplaza, es
// únicamente un hint de presentación calculado con la misma regla (permisoColumnaSync).
function calcularAccionesPermitidas(estado, proyecto, auth, miembro, rol) {
  const disponibles = [];
  for (const [accion, config] of Object.entries(ACCIONES)) {
    if (!config.origenes.includes(estado)) continue;
    for (const columnaDef of proyecto.columnasCheck) {
      if (columnaDef.tipo !== config.tipoColumna) continue;
      const { puede } = permisoColumnaSync(auth, miembro, rol, columnaDef, config.capacidad);
      if (puede) disponibles.push({ accion, columna: columnaDef.nombre });
    }
  }
  return disponibles;
}

async function listar(tenantId, historiaId, auth) {
  const { proyecto } = await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  const criterios = await Criterio.find({ tenantId, historiaId, activo: true }).sort({ orden: 1 });

  // Mismo condicional que evaluarPermisoColumna() para no consultar Rol de más: si es
  // admin, la regla ya es "siempre puede" y no hace falta resolver rol; si no tiene un
  // miembro asignado en el equipo, tampoco hay rol que resolver.
  const miembro = obtenerMiembroEquipo(proyecto, auth);
  const rol = !auth.esAdmin && miembro ? await Rol.findOne({ _id: miembro.rolId, tenantId }) : null;

  return criterios.map((criterio) => ({
    ...criterioPublico(criterio),
    accionesPermitidas: calcularAccionesPermitidas(criterio.estado, proyecto, auth, miembro, rol),
  }));
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

// Crea o continúa el Reporte (caso) de un criterio según el tipo de entrada:
// - 'rechazo': si hay un caso todavía no cerrado lo reabre (ciclo tras solución); si no
//   existe ninguno, crea el primero. El origen de estado ya garantiza cuál es el caso (ver
//   ACCIONES.rechazar.origenes).
// - 'reapertura': el caso anterior (si existe) ya está cerrado — siempre crea uno nuevo.
// - 'solucion'/'cierre': siempre continúan el caso abierto/solucionado existente.
async function registrarEntradaReporte(tenantId, proyectoId, criterioId, tipo, auth, porAdmin, { comentario, evidencias }) {
  const entrada = {
    tipo,
    comentario: comentario || undefined,
    evidencias: evidencias || [],
    usuarioId: auth.usuarioId,
    porAdmin,
    fecha: new Date(),
  };

  if (tipo === 'reapertura') {
    return Reporte.create({ tenantId, proyectoId, criterioId, estadoCaso: 'abierto', entradas: [entrada] });
  }

  const reporte = await Reporte.findOne({
    tenantId,
    criterioId,
    estadoCaso: { $in: ['abierto', 'solucionado'] },
  }).sort({ createdAt: -1 });

  if (!reporte) {
    if (tipo !== 'rechazo') throw new ApiError(400, 'No hay un caso abierto para este criterio');
    return Reporte.create({ tenantId, proyectoId, criterioId, estadoCaso: 'abierto', entradas: [entrada] });
  }

  reporte.entradas.push(entrada);
  if (tipo === 'rechazo') reporte.estadoCaso = 'abierto';
  if (tipo === 'solucion') reporte.estadoCaso = 'solucionado';
  if (tipo === 'cierre') reporte.estadoCaso = 'cerrado';
  await reporte.save();
  return reporte;
}

// POST /criterios/:id/check — el corazón de la máquina de estados (PRD sección 6). Valida,
// en este orden: la columna existe en el proyecto, la acción corresponde al tipo de esa
// columna, el usuario tiene el rol asignado a esa columna (esAdmin lo puentea, pero queda
// marcado como acción administrativa) y la capacidad requerida, y la transición de estado
// es válida desde el estado actual. Acciones que generan reporte (rechazar/solucionar/
// cerrar_caso/reabrir) validan además comentario obligatorio (solo rechazar) y evidencias.
async function aplicarCheck(tenantId, criterioId, auth, { columna, accion, comentario }, archivos) {
  const { criterio, proyecto } = await cargarCriterioConAcceso(tenantId, criterioId, auth);

  stringParaFiltro(columna, 'columna');
  if (!columna) throw new ApiError(400, 'columna es requerida');

  const config = ACCIONES[accion];
  if (!config) throw new ApiError(400, `acción no soportada: ${accion}`);

  const columnaDef = proyecto.columnasCheck.find((c) => c.nombre === columna);
  if (!columnaDef) throw new ApiError(400, `la columna "${columna}" no existe en este proyecto`);

  if (!ACCIONES_POR_TIPO_COLUMNA[columnaDef.tipo]?.includes(accion)) {
    throw new ApiError(400, `la acción "${accion}" no es válida para una columna de tipo "${columnaDef.tipo}"`);
  }

  const { puede, porAdmin, razon } = await evaluarPermisoColumna(tenantId, proyecto, auth, columnaDef, config.capacidad);
  if (!puede) {
    if (razon === 'sin_rol') {
      throw new ApiError(403, `No tienes el rol asignado a la columna "${columna}" en este proyecto`);
    }
    throw new ApiError(403, `Requiere la capacidad "${config.capacidad}" en este proyecto`);
  }

  if (!config.origenes.includes(criterio.estado)) {
    throw new ApiError(
      400,
      `no se puede "${accion}" un criterio en estado ${criterio.estado} (se esperaba ${config.origenes.join(' o ')})`,
    );
  }

  if (config.comentarioRequerido && !comentario) {
    throw new ApiError(400, 'comentario es requerido para esta acción');
  }
  if (comentario !== undefined) {
    stringParaFiltro(comentario, 'comentario');
    validarLongitudMax(comentario, 'comentario', 2000);
  }

  const evidencias = validarYMapearEvidencias(archivos);

  // Reclamo atómico de la transición: el chequeo de origenes de arriba usa `criterio.estado`
  // tal como se cargó al principio de la función, que puede haber quedado desactualizado si
  // otra request concurrente (doble clic, o dos usuarios actuando casi al mismo tiempo)
  // transicionó este mismo criterio en el medio. Un `criterio.save()` sin condición dejaría
  // "ganar" a ambas requests, aplicando la transición dos veces (y, en acciones que generan
  // reporte, duplicando el Reporte). findOneAndUpdate con el estado de origen en el filtro es
  // atómico a nivel de Mongo: como mucho una request matchea y aplica el $set: las demás
  // encuentran el documento ya en un estado que no matchea `origenes` y reciben null.
  const criterioActualizado = await Criterio.findOneAndUpdate(
    { _id: criterioId, tenantId, activo: true, estado: { $in: config.origenes } },
    { $set: { estado: config.destino } },
    { new: true },
  );
  if (!criterioActualizado) {
    throw new ApiError(
      400,
      `no se puede "${accion}" un criterio en estado ${criterio.estado} (se esperaba ${config.origenes.join(' o ')})`,
    );
  }

  const entradaCheck = { columnaNombre: columna, valor: config.valorCheck, usuarioId: auth.usuarioId, fecha: new Date() };
  const idxExistente = criterioActualizado.checks.findIndex((c) => c.columnaNombre === columna);
  if (idxExistente >= 0) criterioActualizado.checks[idxExistente] = entradaCheck;
  else criterioActualizado.checks.push(entradaCheck);
  await criterioActualizado.save();

  if (config.entradaTipo) {
    await registrarEntradaReporte(tenantId, proyecto._id, criterioId, config.entradaTipo, auth, porAdmin, {
      comentario,
      evidencias,
    });
  }

  // eventosAuditoria (PRD sección 8, "opcional simple"): registra específicamente las dos
  // acciones administrativas que el PRD nombra sobre criterios — un esAdmin corrigiendo una
  // columna que no le corresponde, y cualquier reapertura (la reapertura se audita siempre,
  // la corrija o no un esAdmin, porque reabrir un caso ya cerrado es sensible por sí solo).
  if (porAdmin) {
    await auditoriaService.registrar(
      tenantId,
      'criterio',
      criterioId,
      `check_admin:${accion}`,
      auth.usuarioId,
      `Columna "${columna}" corregida por un admin sin el rol asignado (acción "${accion}")`,
    );
  }
  if (accion === 'reabrir') {
    await auditoriaService.registrar(
      tenantId,
      'criterio',
      criterioId,
      'reabrir',
      auth.usuarioId,
      `Criterio reabierto vía columna "${columna}"`,
    );
  }

  return criterioPublico(criterioActualizado);
}

module.exports = { listar, crear, actualizar, eliminar, aplicarCheck };
