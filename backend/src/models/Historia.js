const { Schema, model } = require('mongoose');

const historiaSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // proyectoId denormalizado: permite el contador HU-N "por proyecto" (PRD sección 8)
    // con un simple countDocuments, sin atravesar requerimiento -> modulo -> proyecto.
    proyectoId: { type: Schema.Types.ObjectId, ref: 'Proyecto', required: true },
    requerimientoId: { type: Schema.Types.ObjectId, ref: 'Requerimiento', required: true },
    codigo: { type: String, required: true },
    texto: { type: String, required: true, trim: true },
    // Enlace opcional a un diseño/recurso externo (Figma, doc, etc.) — nunca lo resuelve ni
    // lo hace fetch() el servidor, solo lo abre el navegador del usuario al hacer clic, por
    // eso su validación (ver validarUrlOpcional en utils/validacion.js) es de formato, sin
    // el chequeo DNS/SSRF que sí necesita la URL de un webhook.
    enlace: { type: String, trim: true },
    orden: { type: Number, required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

historiaSchema.index({ tenantId: 1, requerimientoId: 1 });
historiaSchema.index({ tenantId: 1, proyectoId: 1 });
// Único: evita que dos creaciones concurrentes en el mismo proyecto calculen el mismo
// contador y persistan el mismo código HU-N (ver crear() en historia.service.js, que
// reintenta ante el error 11000 que este índice produce).
historiaSchema.index({ tenantId: 1, proyectoId: 1, codigo: 1 }, { unique: true });

module.exports = model('Historia', historiaSchema);
