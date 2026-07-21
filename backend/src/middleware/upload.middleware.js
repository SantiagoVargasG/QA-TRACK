const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { ApiError } = require('./errorHandler');
const { UPLOADS_PATH, MAX_IMAGE_MB, MAX_VIDEO_MB, MIME_PERMITIDOS } = require('../utils/evidencias');

// El directorio destino depende de req.auth.tenantId (ya resuelto por requireAuth, que se
// monta antes que este middleware en la ruta) — nunca de un valor de cliente. El nombre de
// archivo en disco es un UUID generado en servidor, no el originalname del cliente.
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_PATH, req.auth.tenantId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
  },
});

function fileFilter(req, file, cb) {
  if (!MIME_PERMITIDOS.includes(file.mimetype)) {
    return cb(new ApiError(400, `Tipo de archivo no permitido: ${file.mimetype}`));
  }
  cb(null, true);
}

// Límite global de tamaño con el mayor de los dos máximos configurados; el máximo
// específico por tipo (imagen vs. video) se valida por archivo en
// utils/evidencias.js#validarYMapearEvidencias, después de que multer ya escribió a disco.
const subirEvidencias = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.max(MAX_IMAGE_MB, MAX_VIDEO_MB) * 1024 * 1024 },
}).array('evidencias', 10);

module.exports = { subirEvidencias };
