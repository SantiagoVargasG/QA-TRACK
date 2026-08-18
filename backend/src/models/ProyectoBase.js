const { Schema, model } = require('mongoose');

const proyectoBaseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    nombre: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

proyectoBaseSchema.index({ tenantId: 1 });

module.exports = model('ProyectoBase', proyectoBaseSchema);
