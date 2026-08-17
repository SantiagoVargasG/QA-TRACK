const Comentario = require('../models/Comentario');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax } = require('../utils/validacion');
const { validarYMapearEvidencias } = require('../utils/evidencias');
const { cargarCriterioConAcceso } = require('./acceso.service');

function comentarioPublico(comentario) {
  return {
    id: comentario._id,
    criterioId: comentario.criterioId,
    texto: comentario.texto,
    evidencias: comentario.evidencias,
    usuarioId: comentario.usuarioId,
    fecha: comentario.createdAt,
  };
}

// Cualquier miembro del proyecto (o esAdmin) puede comentar — mismo gate de membresía que
// ya usa el histórico de reportes (cargarCriterioConAcceso), sin exigir ninguna capacidad
// de rol: un comentario libre es una anotación liviana, no una acción de contenido ni de
// aprobación, así que ninguna de las capacidades existentes (incluyendo un Lector con
// solo_lectura) queda excluida.
async function listar(tenantId, criterioId, auth) {
  await cargarCriterioConAcceso(tenantId, criterioId, auth);
  const comentarios = await Comentario.find({ tenantId, criterioId }).sort({ createdAt: 1 });
  return comentarios.map(comentarioPublico);
}

async function crear(tenantId, criterioId, auth, { texto }, archivos) {
  const { criterio, proyecto } = await cargarCriterioConAcceso(tenantId, criterioId, auth);

  if (!texto) throw new ApiError(400, 'texto es requerido');
  validarLongitudMax(texto, 'texto', 2000);

  // Mismas validaciones de tipo/tamaño que una entrada de rechazo (MAX_IMAGE_MB/
  // MAX_VIDEO_MB) — multer ya filtró el MIME y aplicó el límite global de tamaño antes de
  // llegar acá (ver middleware/upload.middleware.js); esto valida el máximo específico por
  // tipo y borra TODOS los archivos de la request si alguno se pasa.
  const evidencias = validarYMapearEvidencias(archivos);

  const comentario = await Comentario.create({
    tenantId,
    proyectoId: proyecto._id,
    criterioId: criterio._id,
    texto,
    evidencias,
    usuarioId: auth.usuarioId,
  });
  return comentarioPublico(comentario);
}

module.exports = { listar, crear };
