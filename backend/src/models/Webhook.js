const { Schema, model } = require('mongoose');
const EVENTOS_VALIDOS = require('../config/eventosWebhook');
const PROVEEDORES_VALIDOS = require('../config/proveedoresWebhook');

const webhookSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    nombre: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    proveedor: { type: String, enum: PROVEEDORES_VALIDOS, required: true },
    eventos: [{ type: String, enum: EVENTOS_VALIDOS }],
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

webhookSchema.index({ tenantId: 1, proyectoId: 1 });

module.exports = model('Webhook', webhookSchema);
