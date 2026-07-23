const dns = require('dns').promises;
const net = require('net');
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
const { verificarCapacidadEnProyecto, cargarProyectoConAcceso, cargarHistoriaConAcceso } = require('./acceso.service');
const { enviarConReintentos } = require('./webhookDisparo.service');
const { appBaseUrl } = require('../config/env');

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

// Rangos de red a los que el servidor nunca debe hacer fetch() aunque el cliente los pida
// como destino de un webhook (SSRF): loopback, privados, y link-local (incluye
// 169.254.169.254, el endpoint de metadata de credenciales en AWS/GCP/Azure).
const RANGOS_IPV4_BLOQUEADOS = [
  ['127.0.0.0', 8], // loopback
  ['10.0.0.0', 8], // privado
  ['172.16.0.0', 12], // privado
  ['192.168.0.0', 16], // privado
  ['169.254.0.0', 16], // link-local, incluye metadata de nube
];

function ipv4ANumero(ip) {
  return ip.split('.').reduce((acc, octeto) => (acc << 8) + Number(octeto), 0) >>> 0;
}

function ipv4EnRango(ip, base, bits) {
  const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ANumero(ip) & mascara) === (ipv4ANumero(base) & mascara);
}

function esIpBloqueada(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    return RANGOS_IPV4_BLOQUEADOS.some(([base, bits]) => ipv4EnRango(ip, base, bits));
  }
  if (version === 6) {
    const normalizada = ip.toLowerCase();
    if (normalizada === '::1') return true; // loopback IPv6
    if (normalizada.startsWith('::ffff:')) {
      // IPv4 mapeada en IPv6 (ej. ::ffff:127.0.0.1) — validar la parte IPv4.
      const mapeada = normalizada.split(':').pop();
      if (net.isIP(mapeada) === 4) return esIpBloqueada(mapeada);
    }
    return false;
  }
  return false;
}

const MENSAJE_HOST_BLOQUEADO = 'url no puede apuntar a localhost ni a una dirección interna';

// Un dominio público puede resolver a una IP privada (o cambiar para hacerlo más adelante),
// así que no alcanza con mirar el string de la URL: se resuelve el hostname por DNS — la
// misma resolución que usará el fetch() real en webhookDisparo.service.js — y se valida
// CADA dirección devuelta, no solo la primera (SSRF, ver auditoría de Iteración 6).
async function validarUrl(url) {
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

  if (parsed.hostname.toLowerCase() === 'localhost') {
    throw new ApiError(400, MENSAJE_HOST_BLOQUEADO);
  }

  let direcciones;
  try {
    direcciones = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new ApiError(400, 'no se pudo resolver el host de la url');
  }
  if (direcciones.some((d) => esIpBloqueada(d.address))) {
    throw new ApiError(400, MENSAJE_HOST_BLOQUEADO);
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
  await validarUrl(url);
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
    await validarUrl(url);
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

// POST /historias/:id/reportar-webhook: acción manual disponible para roles con
// aprobar_rechazar (mismo criterio que reportar-prueba — no esAdmin, verificarCapacidadEnProyecto
// resuelve el bypass). Reemplaza el disparo automático por cada check de criterio (demasiado
// ruidoso): el resultado se calcula sobre TODOS los criterios activos de la historia en el
// momento del envío, no sobre el que disparó la última acción.
async function reportarHistoria(tenantId, historiaId, auth) {
  const { historia, proyecto } = await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'aprobar_rechazar');

  const criterios = await Criterio.find({ tenantId, historiaId: historia._id, activo: true });
  if (criterios.length === 0) {
    throw new ApiError(400, 'La historia no tiene criterios de aceptación para reportar');
  }

  const todosAprobados = criterios.every((c) => c.estado === 'APROBADO');
  const resultado = todosAprobados ? 'aprobada' : 'rechazada';

  const criteriosRechazados = [];
  if (!todosAprobados) {
    const rechazados = criterios.filter((c) => c.estado === 'RECHAZADO');
    // eslint-disable-next-line no-restricted-syntax
    for (const criterio of rechazados) {
      // eslint-disable-next-line no-await-in-loop
      const reporte = await Reporte.findOne({ tenantId, criterioId: criterio._id }).sort({ createdAt: -1 });
      const ultimoRechazo = reporte ? [...reporte.entradas].reverse().find((e) => e.tipo === 'rechazo') : null;
      criteriosRechazados.push({ criterio: criterio.texto, comentario: ultimoRechazo?.comentario || '' });
    }
  }

  const requerimiento = await Requerimiento.findOne({ _id: historia.requerimientoId, tenantId }).select('moduloId');
  const modulo = requerimiento
    ? await Modulo.findOne({ _id: requerimiento.moduloId, tenantId }).select('nombre')
    : null;

  // Deep link a la HU exacta dentro del módulo (ver ModuloDetallePage.jsx, que enfoca la HU
  // indicada por el query param `hu`). APP_BASE_URL nunca se infiere de un header de
  // request — es una variable de entorno fija del servidor.
  const urlHu = requerimiento ? `${appBaseUrl}/modulos/${requerimiento.moduloId}?hu=${historia._id}` : appBaseUrl;

  const usuario = await Usuario.findOne({ _id: auth.usuarioId, tenantId }).select('nombre');
  const contexto = {
    evento: 'hu_reportada',
    proyecto: proyecto.nombre,
    modulo: modulo?.nombre || '',
    hu: `${historia.codigo}: ${historia.texto}`,
    resultado,
    criterios_rechazados: criteriosRechazados,
    url_hu: urlHu,
    autor: usuario?.nombre || '',
    fecha: new Date().toISOString(),
  };

  const webhooks = await Webhook.find({
    tenantId,
    proyectoId: proyecto._id,
    activo: true,
    eventos: 'hu_reportada',
  });
  // Sin await, mismo motivo que reportar-prueba: la entrega (con reintentos, hasta ~30s por
  // webhook) nunca debe bloquear la respuesta de este botón manual.
  webhooks.forEach((webhook) => {
    enviarConReintentos(webhook, contexto).catch((err) => {
      console.error(`[webhooks] reportarHistoria: "${webhook.nombre}" falló:`, err.message);
    });
  });

  return { ...contexto, webhooksNotificados: webhooks.length };
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

module.exports = { listar, crear, actualizar, eliminar, reportarHistoria, reportarPrueba };
