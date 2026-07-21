const { Schema, model } = require('mongoose');

const evidenciaSchema = new Schema(
  {
    archivo: { type: String, required: true },
    tipoMime: { type: String, required: true },
    tamaño: { type: Number, required: true },
  },
  { _id: false },
);

const entradaSchema = new Schema(
  {
    tipo: { type: String, enum: ['rechazo', 'solucion', 'reapertura', 'cierre'], required: true },
    comentario: { type: String, trim: true },
    evidencias: [evidenciaSchema],
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    // true cuando un esAdmin ejecutó la acción puenteando el rol asignado a la columna
    // (PRD 5.2: "corregir cualquier columna... registrándolo en el histórico como acción
    // administrativa"). No hay un tipo de entrada separado para esto: se marca la MISMA
    // entrada (rechazo/solucion/cierre/reapertura) con este flag en vez de duplicar el dato.
    porAdmin: { type: Boolean, default: false },
    fecha: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const reporteSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // proyectoId denormalizado, mismo patrón que criterios/historias/requerimientos:
    // resuelve control de acceso sin atravesar criterio -> historia -> ... -> proyecto.
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    criterioId: { type: Schema.Types.ObjectId, ref: 'Criterio', required: true },
    estadoCaso: { type: String, enum: ['abierto', 'solucionado', 'cerrado'], default: 'abierto' },
    entradas: [entradaSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reporteSchema.index({ tenantId: 1, criterioId: 1 });

module.exports = model('Reporte', reporteSchema);
