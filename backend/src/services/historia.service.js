const Historia = require('../models/Historia');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, validarUrlOpcional } = require('../utils/validacion');
const {
  verificarCapacidadEnProyecto,
  cargarRequerimientoConAcceso,
  cargarHistoriaConAcceso,
} = require('./acceso.service');

function historiaPublica(historia) {
  return {
    id: historia._id,
    requerimientoId: historia.requerimientoId,
    codigo: historia.codigo,
    texto: historia.texto,
    enlace: historia.enlace || undefined,
    orden: historia.orden,
    activo: historia.activo,
  };
}

async function listar(tenantId, requerimientoId, auth) {
  await cargarRequerimientoConAcceso(tenantId, requerimientoId, auth);
  const historias = await Historia.find({ tenantId, requerimientoId, activo: true }).sort({ orden: 1 });
  return historias.map(historiaPublica);
}

async function crear(tenantId, requerimientoId, auth, { texto, enlace }) {
  const { requerimiento, proyecto } = await cargarRequerimientoConAcceso(tenantId, requerimientoId, auth);
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (!texto) throw new ApiError(400, 'texto es requerido');
  validarLongitudMax(texto, 'texto', 1000);
  const enlaceValidado = validarUrlOpcional(enlace, 'enlace');

  const ultimo = await Historia.findOne({ tenantId, requerimientoId }).sort({ orden: -1 });
  const orden = ultimo ? ultimo.orden + 1 : 1;

  // El código HU-N es correlativo POR PROYECTO (PRD sección 8) y nunca se reutiliza,
  // aunque se borren (soft-delete) historias — por eso el conteo no filtra por activo.
  // Dos creaciones concurrentes pueden leer el mismo conteo antes de que la primera
  // inserte; el índice único (tenantId, proyectoId, codigo) del modelo rechaza esa
  // segunda inserción con error 11000, y se reintenta con un conteo fresco.
  const MAX_INTENTOS = 5;
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    const totalPrevias = await Historia.countDocuments({ tenantId, proyectoId: proyecto._id });
    const codigo = `HU-${totalPrevias + 1}`;
    try {
      const historia = await Historia.create({
        tenantId,
        proyectoId: proyecto._id,
        requerimientoId,
        codigo,
        texto,
        enlace: enlaceValidado || undefined,
        orden,
      });
      return historiaPublica(historia);
    } catch (err) {
      const esColisionDeCodigo = err.code === 11000;
      if (!esColisionDeCodigo || intento === MAX_INTENTOS) throw err;
    }
  }
}

async function actualizar(tenantId, requerimientoId, historiaId, auth, { texto, enlace }) {
  const { historia, proyecto } = await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  if (historia.requerimientoId.toString() !== requerimientoId) throw new ApiError(404, 'Historia no encontrada');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  if (texto !== undefined) {
    validarLongitudMax(texto, 'texto', 1000);
    historia.texto = texto;
  }
  // enlace sigue el mismo criterio que texto (undefined = no tocar), con un caso extra:
  // '' limpia el campo explícitamente (permite quitar un enlace ya guardado).
  const enlaceValidado = validarUrlOpcional(enlace, 'enlace');
  if (enlaceValidado !== undefined) historia.enlace = enlaceValidado || undefined;

  await historia.save();
  return historiaPublica(historia);
}

async function eliminar(tenantId, requerimientoId, historiaId, auth) {
  const { historia, proyecto } = await cargarHistoriaConAcceso(tenantId, historiaId, auth);
  if (historia.requerimientoId.toString() !== requerimientoId) throw new ApiError(404, 'Historia no encontrada');
  await verificarCapacidadEnProyecto(proyecto, auth, 'gestionar_contenido');

  historia.activo = false;
  await historia.save();
  return historiaPublica(historia);
}

module.exports = { listar, crear, actualizar, eliminar };
