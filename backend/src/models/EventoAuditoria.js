const { Schema, model } = require('mongoose');

// Log de solo-escritura para acciones administrativas (PRD sección 8, "opcional simple").
// Sin borrado ni actualización: cada evento es un hecho consumado, no una entidad editable.
const eventoAuditoriaSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entidad: { type: String, required: true },
  entidadId: { type: Schema.Types.ObjectId, required: true },
  accion: { type: String, required: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  detalle: { type: String, default: '' },
  fecha: { type: Date, required: true, default: Date.now },
});

eventoAuditoriaSchema.index({ tenantId: 1, fecha: -1 });

module.exports = model('EventoAuditoria', eventoAuditoriaSchema);
