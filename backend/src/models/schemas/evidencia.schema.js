const { Schema } = require('mongoose');

// Sub-schema compartido para un archivo de evidencia (imagen/video) referenciado desde
// cualquier colección que acepte adjuntos — hoy Reporte (entradas de rechazo/solución/
// reapertura/cierre) y Comentario (comentarios libres). El nombre en disco (`archivo`) es
// siempre un UUID generado en servidor (ver middleware/upload.middleware.js), nunca el
// originalname del cliente.
const evidenciaSchema = new Schema(
  {
    archivo: { type: String, required: true },
    tipoMime: { type: String, required: true },
    tamaño: { type: Number, required: true },
  },
  { _id: false },
);

module.exports = evidenciaSchema;
