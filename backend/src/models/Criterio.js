const { Schema, model } = require('mongoose');
const ESTADOS_VALIDOS = require('../config/estadosCriterio');

const checkSchema = new Schema(
  {
    columnaNombre: { type: String, required: true },
    valor: { type: String, required: true },
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    fecha: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const criterioSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // proyectoId denormalizado (mismo patrón que requerimientos/historias): simplifica
    // el control de acceso sin atravesar historia -> requerimiento -> modulo -> proyecto.
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    historiaId: { type: Schema.Types.ObjectId, ref: 'Historia', required: true },
    texto: { type: String, required: true, trim: true },
    orden: { type: Number, required: true },
    estado: { type: String, enum: ESTADOS_VALIDOS, default: 'PENDIENTE' },
    checks: [checkSchema],
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

criterioSchema.index({ tenantId: 1, historiaId: 1 });

module.exports = model('Criterio', criterioSchema);
