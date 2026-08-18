const ProyectoBase = require('../models/ProyectoBase');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, booleanoOpcional } = require('../utils/validacion');

function proyectoBasePublico(base) {
  return {
    id: base._id,
    nombre: base.nombre,
    activo: base.activo,
  };
}

// Sin filtro activo:true, a diferencia del lookup interno que hace proyectoService.listar()
// para agrupar: esta lista alimenta la pantalla de gestión (admin), que necesita ver
// también las bases inactivas para poder reactivarlas — mismo patrón que
// usuarioService.listar() (nunca filtra activo, la UI de gestión muestra ambos estados).
async function listar(tenantId) {
  const bases = await ProyectoBase.find({ tenantId }).sort({ createdAt: 1 });
  return bases.map(proyectoBasePublico);
}

async function crear(tenantId, { nombre }) {
  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  validarLongitudMax(nombre, 'nombre', 100);

  const base = await ProyectoBase.create({ tenantId, nombre });
  return proyectoBasePublico(base);
}

// Sin filtro activo:true en el findOne: a diferencia de actualizar() en el resto de
// entidades de contenido, este también debe poder encontrar una base ya inactivada para
// reactivarla (mismo patrón que usuarioService.actualizar(), que reactiva vía
// `{ activo: true }` en el body).
async function actualizar(tenantId, id, { nombre, activo }) {
  const base = await ProyectoBase.findOne({ _id: id, tenantId });
  if (!base) throw new ApiError(404, 'Proyecto base no encontrado');

  if (nombre !== undefined) {
    validarLongitudMax(nombre, 'nombre', 100);
    base.nombre = nombre;
  }
  const activoValidado = booleanoOpcional(activo, 'activo');
  if (activoValidado !== undefined) base.activo = activoValidado;

  await base.save();
  return proyectoBasePublico(base);
}

// Inactivar (no eliminar físico, no cascada): las sub-vistas (Proyecto.proyectoBaseId ===
// este id) NO se tocan — siguen con su propio activo intacto. Se ocultan del listado
// agrupado solo porque su base ya no aparece en listar(), ver proyectoService.listar().
// Reactivar la base (actualizar con { activo: true }) las vuelve a mostrar de inmediato,
// sin haber escrito nada sobre ellas en ningún momento.
async function eliminar(tenantId, id) {
  const base = await ProyectoBase.findOne({ _id: id, tenantId, activo: true });
  if (!base) throw new ApiError(404, 'Proyecto base no encontrado');

  base.activo = false;
  await base.save();
  return proyectoBasePublico(base);
}

module.exports = { listar, crear, actualizar, eliminar };
