const EventoAuditoria = require('../models/EventoAuditoria');

function eventoPublico(evento) {
  return {
    id: evento._id,
    entidad: evento.entidad,
    entidadId: evento.entidadId,
    accion: evento.accion,
    usuarioId: evento.usuarioId,
    detalle: evento.detalle,
    fecha: evento.fecha,
  };
}

// Registrar un evento de auditoría nunca debe tumbar la operación de negocio que lo
// originó — un fallo acá (ej. un hiccup transitorio de Mongo) solo se loguea en servidor.
async function registrar(tenantId, entidad, entidadId, accion, usuarioId, detalle = '') {
  try {
    await EventoAuditoria.create({ tenantId, entidad, entidadId, accion, usuarioId, detalle });
  } catch (err) {
    console.error('[auditoria] no se pudo registrar el evento:', err.message);
  }
}

async function listar(tenantId) {
  const eventos = await EventoAuditoria.find({ tenantId }).sort({ fecha: -1 }).limit(200);
  return eventos.map(eventoPublico);
}

module.exports = { registrar, listar };
