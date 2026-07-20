const { Schema, model } = require('mongoose');

const columnaCheckSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ['finalizado', 'aprobacion'], required: true },
    rolId: { type: Schema.Types.ObjectId, ref: 'Rol', default: null },
  },
  { _id: false },
);

const miembroEquipoSchema = new Schema(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    rolId: { type: Schema.Types.ObjectId, ref: 'Rol', required: true },
  },
  { _id: false },
);

const proyectoSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: '', trim: true },
    columnasCheck: [columnaCheckSchema],
    equipo: [miembroEquipoSchema],
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

proyectoSchema.index({ tenantId: 1 });

module.exports = model('Proyecto', proyectoSchema);
