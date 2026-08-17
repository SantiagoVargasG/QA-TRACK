const { Schema, model } = require('mongoose');
const evidenciaSchema = require('./schemas/evidencia.schema');

// Comentario libre sobre un criterio de aceptación: a diferencia de las entradas de
// `Reporte` (línea de tiempo de incidencias, generadas solo como efecto colateral de una
// transición de estado válida), un Comentario no está atado a ninguna acción de la máquina
// de estados ni a un "caso" — se puede escribir en cualquier momento, sin importar el
// estado del criterio. Por eso es una colección propia y no una entrada más de Reporte.
// `evidencias` es opcional (igual que en Reporte) y usa el mismo sub-schema y las mismas
// validaciones de tipo/tamaño (validarYMapearEvidencias) que las entradas de rechazo.
const comentarioSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // proyectoId denormalizado, mismo patrón que Criterio/Reporte: resuelve control de
    // acceso sin atravesar criterio -> historia -> ... -> proyecto.
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    criterioId: { type: Schema.Types.ObjectId, ref: 'Criterio', required: true },
    texto: { type: String, required: true, trim: true },
    evidencias: [evidenciaSchema],
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

comentarioSchema.index({ tenantId: 1, criterioId: 1 });

module.exports = model('Comentario', comentarioSchema);
