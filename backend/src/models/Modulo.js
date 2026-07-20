const { Schema, model } = require('mongoose');

const moduloSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    nombre: { type: String, required: true, trim: true },
    icono: { type: String, default: 'carpeta' },
    descripcion: { type: String, default: '', trim: true },
    orden: { type: Number, required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

moduloSchema.index({ tenantId: 1, proyectoId: 1 });

module.exports = model('Modulo', moduloSchema);
