const { Schema, model } = require('mongoose');
const CAPACIDADES_VALIDAS = require('../config/capacidades');

const rolSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    nombre: { type: String, required: true, trim: true },
    capacidades: [{ type: String, enum: CAPACIDADES_VALIDAS }],
    esSemilla: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

rolSchema.index({ tenantId: 1, nombre: 1 }, { unique: true });

module.exports = model('Rol', rolSchema);
