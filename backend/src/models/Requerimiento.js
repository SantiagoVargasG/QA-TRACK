const { Schema, model } = require('mongoose');

const requerimientoSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // proyectoId denormalizado desde modulo.proyectoId: simplifica el control de acceso
    // y evita joins para operaciones que necesitan el proyecto directamente.
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    moduloId: { type: Schema.Types.ObjectId, ref: 'Modulo', required: true },
    titulo: { type: String, required: true, trim: true },
    descripcionResumida: { type: String, required: true, trim: true, maxlength: 500 },
    descripcionExtendida: { type: String, default: '', trim: true },
    orden: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

requerimientoSchema.index({ tenantId: 1, moduloId: 1 });

module.exports = model('Requerimiento', requerimientoSchema);
