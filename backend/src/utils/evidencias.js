const fs = require('fs');
const { ApiError } = require('../middleware/errorHandler');

// Ruta base y límites configurables por variable de entorno (PRD sección 2 y 6).
const UPLOADS_PATH = process.env.UPLOADS_PATH || './uploads';
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 10);
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 100);

const MIME_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'];
const MIME_VIDEO = ['video/mp4', 'video/webm'];
const MIME_PERMITIDOS = [...MIME_IMAGEN, ...MIME_VIDEO];

function limpiarArchivos(archivos) {
  for (const archivo of archivos || []) {
    fs.unlink(archivo.path, () => {});
  }
}

// Multer ya filtró por MIME (fileFilter) y aplicó un límite global de tamaño (el mayor de
// los dos), pero imagen y video tienen máximos distintos — eso se valida acá, por archivo,
// antes de persistir cualquier referencia en Mongo. Si un archivo excede su máximo, se
// borran TODOS los archivos de la request (no dejar evidencias huérfanas en disco).
function validarYMapearEvidencias(archivos) {
  const evidencias = [];
  for (const archivo of archivos || []) {
    const esImagen = MIME_IMAGEN.includes(archivo.mimetype);
    const maxBytes = (esImagen ? MAX_IMAGE_MB : MAX_VIDEO_MB) * 1024 * 1024;
    if (archivo.size > maxBytes) {
      limpiarArchivos(archivos);
      const maxMb = esImagen ? MAX_IMAGE_MB : MAX_VIDEO_MB;
      throw new ApiError(400, `El archivo ${archivo.originalname} supera el máximo de ${maxMb} MB`);
    }
    evidencias.push({ archivo: archivo.filename, tipoMime: archivo.mimetype, tamaño: archivo.size });
  }
  return evidencias;
}

module.exports = {
  UPLOADS_PATH,
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MIME_IMAGEN,
  MIME_VIDEO,
  MIME_PERMITIDOS,
  limpiarArchivos,
  validarYMapearEvidencias,
};
