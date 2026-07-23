const { Schema, model } = require('mongoose');

const usuarioSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    nombre: { type: String, required: true, trim: true },
    // Login resuelve el tenant a partir del email (ver auth.service.js#login), por lo que
    // el email debe ser único a nivel GLOBAL, no por tenant — un mismo email no puede
    // pertenecer a dos tenants distintos.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    esAdmin: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

usuarioSchema.index({ tenantId: 1 });

module.exports = model('Usuario', usuarioSchema);
