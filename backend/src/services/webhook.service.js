const Webhook = require('../models/Webhook');
const Proyecto = require('../models/Proyecto');
const Modulo = require('../models/Modulo');
const Requerimiento = require('../models/Requerimiento');
const Historia = require('../models/Historia');
const Criterio = require('../models/Criterio');
const Reporte = require('../models/Reporte');
const Usuario = require('../models/Usuario');
const EVENTOS_VALIDOS = require('../config/eventosWebhook');
const PROVEEDORES_VALIDOS = require('../config/proveedoresWebhook');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro, booleanoOpcional } = require('../utils/validacion');
const { verificarCapacidadEnProyecto, cargarProyectoConAcceso } = require('./acceso.service');
const { enviarConReintentos } = require('./webhookDisparo.service');

const RESULTADOS_PRUEBA_VALIDOS = ['exitosa', 'con_errores'];

function webhookPublico(webhook) {
  return {
    id: webhook._id,
    proyectoId: webhook.proyectoId,
    nombre: webhook.nombre,
    url: webhook.url,
    proveedor: webhook.proveedor,
    eventos: webhook.eventos,
    activo: webhook.activo,
  };
}

function validarUrl(url) {
  stringParaFiltro(url, 'url');
  if (!url) throw new ApiError(400, 'url es requerida');
  validarLongitudMax(url, 'url', 500);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, 'url debe ser una URL http(s) válida');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiError(400, 'url debe ser una URL http(s) válida');
  }
}

function validarEventos(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) {
    throw new ApiError(400, 'eventos debe ser un arreglo con al menos un elemento');
  }
  for (const evento of eventos) {
    stringParaFiltro(evento, 'eventos');
    if (!EVENTOS_VALIDOS.includes(evento)) throw new ApiError(400, `evento inválido: ${evento}`);
  }
}

async function cargarProyectoDelTenant(tenantId, proyectoId) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');
  return proyecto;
}

// ---- CRUD (nivel tenant, requiere esAdmin — mismo patrón que equipo/columnas-check de
// proyecto.service.js: findOne directo, no cargarProyectoConAcceso, porque esAdmin ya está
// garantizado por el middleware requireAdmin en la ruta) ----

async function listar(tenantId, proyectoId) {
  await cargarProyectoDelTenant(tenantId, proyectoId);
  const webhooks = await Webhook.find({ tenantId, proyectoId }).sort({ createdAt: 1 });
  return webhooks.map(webhookPublico);
}

async function crear(tenantId, proyectoId, { nombre, url, proveedor, eventos, activo }) {
  await cargarProyectoDelTenant(tenantId, proyectoId);

  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  validarLongitudMax(nombre, 'nombre', 100);
  validarUrl(url);
  if (!PROVEEDORES_VALIDOS.includes(proveedor)) throw new ApiError(400, `proveedor inválido: ${proveedor}`);
  validarEventos(eventos);
  const activoValidado = booleanoOpcional(activo, 'activo');

  const webhook = await Webhook.create({
    tenantId,
    proyectoId,
    nombre,
    url,
    proveedor,
    eventos,
    activo: activoValidado === undefined ? true : activoValidado,
  });
  return webhookPublico(webhook);
}

async function actualizar(tenantId, proyectoId, webhookId, { nombre, url, proveedor, eventos, activo }) {
  await cargarProyectoDelTenant(tenantId, proyectoId);
  const webhook = await Webhook.findOne({ _id: webhookId, tenantId, proyectoId });
  if (!webhook) throw new ApiError(404, 'Webhook no encontrado');

  if (nombre !== undefined) {
    validarLongitudMax(nombre, 'nombre', 100);
    webhook.nombre = nombre;
  }
  if (url !== undefined) {
    validarUrl(url);
    webhook.url = url;
  }
  if (proveedor !== undefined) {
    if (!PROVEEDORES_VALIDOS.includes(proveedor)) throw new ApiError(400, `proveedor inválido: ${proveedor}`);
    webhook.proveedor = proveedor;
  }
  if (eventos !== undefined) {
    validarEventos(eventos);
    webhook.eventos = eventos;
  }
  const activoValidado = booleanoOpcional(activo, 'activo');
  if (activoValidado !== undefined) webhook.activo = activoValidado;

  await webhook.save();
  return webhookPublico(webhook);
}

// Eliminación física (no soft-delete): a diferencia del árbol de contenido, la
// configuración de un webhook no tiene una regla de histórico inmutable que preservar, y el
// campo `activo` ya se usa para habilitar/deshabilitarlo sin borrarlo — mantener ambos
// conceptos separados evita que un webhook "eliminado" siga apareciendo en el listado igual
// que uno simplemente desactivado.
async function eliminar(tenantId, proyectoId, webhookId) {
  await cargarProyectoDelTenant(tenantId, proyectoId);
  const resultado = await Webhook.deleteOne({ _id: webhookId, tenantId, proyectoId });
  if (resultado.deletedCount === 0) throw new ApiError(404, 'Webhook no encontrado');
  return { ok: true };
}

// ---- Disparo de eventos ----

// Dispara `evento` a todos los webhooks activos del proyecto suscritos a él. Sale rápido
// (sin tocar Historia/Requerimiento/Modulo/Usuario) si no hay ningún webhook suscrito — la
// mayoría de los checks de criterio no tienen webhooks configurados, y no tiene sentido
// pagar ese costo en el camino común. Nunca lanza al llamador: cada envío se resuelve o
// falla de forma independiente y se loguea, nunca bloquea la respuesta al usuario (se debe
// invocar sin `await` desde el caller).
async function notificarEventoCriterio(tenantId, proyecto, criterio, evento, { comentario, auth }) {
  const webhooks = await Webhook.find({ tenantId, proyectoId: proyecto._id, activo: true, eventos: evento });
  if (webhooks.length === 0) return;

  const historia = await Historia.findOne({ _id: criterio.historiaId, tenantId }).select('codigo texto requerimientoId');
  const requerimiento = historia
    ? await Requerimiento.findOne({ _id: historia.requerimientoId, tenantId }).select('moduloId')
    : null;
  const modulo = requerimiento ? await Modulo.findOne({ _id: requerimiento.moduloId, tenantId }).select('nombre') : null;
  const usuario = await Usuario.findOne({ _id: auth.usuarioId, tenantId }).select('nombre');

  const contexto = {
    evento,
    proyecto: proyecto.nombre,
    modulo: modulo?.nombre || '',
    historia: historia ? `${historia.codigo}: ${historia.texto}` : '',
    criterio: criterio.texto,
    comentario: comentario || undefined,
    autor: usuario?.nombre || '',
    fecha: new Date().toISOString(),
  };

  await Promise.all(
    webhooks.map((webhook) =>
      enviarConReintentos(webhook, contexto).catch((err) => {
        console.error(`[webhooks] notificarEventoCriterio: "${webhook.nombre}" falló:`, err.message);
      }),
    ),
  );
}

// POST /proyectos/:id/reportar-prueba (PRD sección 7.3): acción manual disponible para
// roles con aprobar_rechazar. Arma el payload estándar de la sección 7.4 y dispara el evento
// prueba_reportada a los webhooks suscritos del proyecto.
async function reportarPrueba(tenantId, proyectoId, auth, { moduloId, historiaIds, resultado, comentario }) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'aprobar_rechazar');

  stringParaFiltro(moduloId, 'moduloId');
  if (!moduloId) throw new ApiError(400, 'moduloId es requerido');
  const modulo = await Modulo.findOne({ _id: moduloId, tenantId, proyectoId: proyecto._id, activo: true });
  if (!modulo) throw new ApiError(400, 'el módulo indicado no existe en este proyecto');

  if (!Array.isArray(historiaIds) || historiaIds.length === 0) {
    throw new ApiError(400, 'historiaIds debe ser un arreglo con al menos un elemento');
  }
  historiaIds.forEach((id) => {
    stringParaFiltro(id, 'historiaIds');
    if (!id) throw new ApiError(400, 'historiaIds debe contener solo ids no vacíos');
  });

  if (!RESULTADOS_PRUEBA_VALIDOS.includes(resultado)) {
    throw new ApiError(400, `resultado inválido: ${resultado}`);
  }
  if (comentario !== undefined) {
    stringParaFiltro(comentario, 'comentario');
    validarLongitudMax(comentario, 'comentario', 2000);
  }

  const historias = await Historia.find({
    _id: { $in: historiaIds },
    tenantId,
    proyectoId: proyecto._id,
    activo: true,
  }).sort({ orden: 1 });
  if (historias.length !== new Set(historiaIds).size) {
    throw new ApiError(400, 'una o más historias no existen en este proyecto');
  }

  const requerimientoIds = [...new Set(historias.map((h) => h.requerimientoId.toString()))];
  const requerimientos = await Requerimiento.find({
    _id: { $in: requerimientoIds },
    tenantId,
    moduloId: modulo._id,
  });
  if (requerimientos.length !== requerimientoIds.length) {
    throw new ApiError(400, 'las historias seleccionadas no pertenecen todas al módulo indicado');
  }

  const criteriosRechazados = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const historia of historias) {
    // eslint-disable-next-line no-await-in-loop
    const criterios = await Criterio.find({
      tenantId,
      historiaId: historia._id,
      activo: true,
      estado: 'RECHAZADO',
    });
    // eslint-disable-next-line no-restricted-syntax
    for (const criterio of criterios) {
      // eslint-disable-next-line no-await-in-loop
      const reporte = await Reporte.findOne({ tenantId, criterioId: criterio._id }).sort({ createdAt: -1 });
      const ultimoRechazo = reporte ? [...reporte.entradas].reverse().find((e) => e.tipo === 'rechazo') : null;
      criteriosRechazados.push({
        hu: historia.codigo,
        criterio: criterio.texto,
        comentario: ultimoRechazo?.comentario || '',
      });
    }
  }

  const usuario = await Usuario.findOne({ _id: auth.usuarioId, tenantId }).select('nombre');
  const contexto = {
    evento: 'prueba_reportada',
    proyecto: proyecto.nombre,
    modulo: modulo.nombre,
    historias: historias.map((h) => `${h.codigo}: ${h.texto}`),
    resultado,
    criterios_rechazados: criteriosRechazados,
    comentario: comentario || undefined,
    autor: usuario?.nombre || '',
    fecha: new Date().toISOString(),
  };

  const webhooks = await Webhook.find({
    tenantId,
    proyectoId: proyecto._id,
    activo: true,
    eventos: 'prueba_reportada',
  });
  // Sin await: reportar-prueba responde de inmediato con cuántos webhooks fueron
  // encolados, sin esperar los reintentos (hasta ~30s por webhook) — la entrega real se
  // resuelve y se loguea en segundo plano, igual que notificarEventoCriterio.
  webhooks.forEach((webhook) => {
    enviarConReintentos(webhook, contexto).catch((err) => {
      console.error(`[webhooks] reportarPrueba: "${webhook.nombre}" falló:`, err.message);
    });
  });

  return { ...contexto, webhooksNotificados: webhooks.length };
}

module.exports = { listar, crear, actualizar, eliminar, notificarEventoCriterio, reportarPrueba };
