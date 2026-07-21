const path = require('path');
const Reporte = require('../models/Reporte');
const { ApiError } = require('../middleware/errorHandler');
const { UPLOADS_PATH } = require('../utils/evidencias');
const { cargarProyectoConAcceso } = require('./acceso.service');

// El nombre en disco siempre lo generamos nosotros como UUID+extensión (ver
// upload.middleware.js), así que un valor que no matchee esta forma no puede ser un
// archivo real — se rechaza antes de tocar el filesystem (evita path traversal via `..`/`/`).
const NOMBRE_ARCHIVO_VALIDO = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/;

// GET /uploads/:archivo — el tenant se resuelve SIEMPRE de auth.tenantId (nunca de la URL),
// y además se re-verifica que el usuario tenga acceso al proyecto dueño del reporte que
// referencia esta evidencia (mismo criterio de acceso que el resto del contenido: 404 si no
// es miembro del equipo ni esAdmin), no solo que sea del mismo tenant.
async function resolverArchivo(tenantId, auth, archivo) {
  if (typeof archivo !== 'string' || !NOMBRE_ARCHIVO_VALIDO.test(archivo)) {
    throw new ApiError(400, 'Nombre de archivo inválido');
  }

  const reporte = await Reporte.findOne({ tenantId, 'entradas.evidencias.archivo': archivo });
  if (!reporte) throw new ApiError(404, 'Archivo no encontrado');

  await cargarProyectoConAcceso(tenantId, reporte.proyectoId, auth);

  const evidencia = reporte.entradas.flatMap((e) => e.evidencias).find((ev) => ev.archivo === archivo);

  return {
    rutaAbsoluta: path.resolve(UPLOADS_PATH, tenantId, archivo),
    tipoMime: evidencia.tipoMime,
  };
}

module.exports = { resolverArchivo };
