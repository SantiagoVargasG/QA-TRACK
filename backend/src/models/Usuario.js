const { Schema, model } = require('mongoose');

const usuarioSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    esAdmin: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

usuarioSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = model('Usuario', usuarioSchema);
