const Proyecto = require('../models/Proyecto');
const ProyectoBase = require('../models/ProyectoBase');
const Usuario = require('../models/Usuario');
const Rol = require('../models/Rol');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const { cargarProyectoConAcceso } = require('./acceso.service');
const auditoriaService = require('./auditoria.service');

const TIPOS_COLUMNA_VALIDOS = ['finalizado', 'aprobacion'];

// `basesPorId` (Map<string, nombre>) es opcional: solo listar() la arma con un batch fetch,
// para no pagar una query extra por proyecto en el resto de las operaciones (crear/
// actualizar/etc. no la necesitan de inmediato — el frontend refresca con cargarProyectos()
// justo después de cualquier mutación).
function proyectoPublico(proyecto, basesPorId) {
  const proyectoBaseId = proyecto.proyectoBaseId || null;
  return {
    id: proyecto._id,
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion,
    proyectoBaseId,
    proyectoBaseNombre: proyectoBaseId && basesPorId ? basesPorId.get(String(proyectoBaseId)) ?? null : null,
    columnasCheck: proyecto.columnasCheck,
    equipo: proyecto.equipo,
    activo: proyecto.activo,
  };
}

async function listar(tenantId, auth) {
  const filtro = auth.esAdmin
    ? { tenantId, activo: true }
    : { tenantId, activo: true, 'equipo.usuarioId': auth.usuarioId };
  const proyectos = await Proyecto.find(filtro).sort({ createdAt: 1 });

  const baseIds = [...new Set(proyectos.filter((p) => p.proyectoBaseId).map((p) => String(p.proyectoBaseId)))];
  const bases = baseIds.length
    ? await ProyectoBase.find({ _id: { $in: baseIds }, tenantId, activo: true })
    : [];
  const basesPorId = new Map(bases.map((b) => [String(b._id), b.nombre]));

  // Una sub-vista cuyo Proyecto Base fue inactivado se oculta del listado agrupado junto
  // con él, sin escribir nada sobre el propio Proyecto (sigue accesible por URL directa) —
  // ver proyectoBaseService.eliminar(). Reactivar la base la vuelve a mostrar de inmediato.
  const visibles = proyectos.filter((p) => !p.proyectoBaseId || basesPorId.has(String(p.proyectoBaseId)));

  return visibles.map((p) => proyectoPublico(p, basesPorId));
}

async function obtener(tenantId, proyectoId, auth) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  return proyectoPublico(proyecto);
}

// Endpoint liviano para resolver iniciales/nombre de los integrantes del equipo (ej.
// avatares en el dashboard) sin exponer el resto de los campos de Usuario ni requerir
// esAdmin como GET /usuarios — cualquier miembro del proyecto (o admin) puede consultarlo,
// mismo control de acceso que el resto de las rutas de proyecto.
async function miembros(tenantId, proyectoId, auth) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  const usuarioIds = proyecto.equipo.map((m) => m.usuarioId);
  const usuarios = await Usuario.find({ _id: { $in: usuarioIds }, tenantId, activo: true }, 'nombre').lean();
  return usuarios.map((u) => ({ id: u._id, nombre: u.nombre }));
}

async function crear(tenantId, { nombre, descripcion, proyectoBaseId, clonarDesdeProyectoId }) {
  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  validarLongitudMax(nombre, 'nombre', 100);
  if (descripcion !== undefined) validarLongitudMax(descripcion, 'descripcion', 1000);

  let proyectoBaseIdValidado = null;
  if (proyectoBaseId) {
    stringParaFiltro(proyectoBaseId, 'proyectoBaseId');
    const base = await ProyectoBase.findOne({ _id: proyectoBaseId, tenantId, activo: true });
    if (!base) throw new ApiError(400, `proyectoBaseId ${proyectoBaseId} no existe en este tenant`);
    proyectoBaseIdValidado = base._id;
  }

  // Clonar equipo/columnasCheck de un proyecto existente del mismo tenant: reutiliza
  // configuración ya validada (los rolId/usuarioId de ese proyecto ya pasaron por
  // actualizarEquipo/actualizarColumnasCheck en su momento), sin lógica de permisos nueva —
  // requireAdmin ya gatea todo este endpoint, igual que la creación normal.
  let equipoClonado = [];
  let columnasCheckClonadas = null;
  if (clonarDesdeProyectoId) {
    stringParaFiltro(clonarDesdeProyectoId, 'clonarDesdeProyectoId');
    const origen = await Proyecto.findOne({ _id: clonarDesdeProyectoId, tenantId, activo: true });
    if (!origen) throw new ApiError(400, `clonarDesdeProyectoId ${clonarDesdeProyectoId} no existe en este tenant`);
    equipoClonado = origen.equipo.map((m) => ({ usuarioId: m.usuarioId, rolId: m.rolId }));
    columnasCheckClonadas = origen.columnasCheck.map((c) => ({ nombre: c.nombre, tipo: c.tipo, rolId: c.rolId }));
  }

  let columnasCheck = columnasCheckClonadas;
  if (!columnasCheck) {
    // Columnas de check por defecto (PRD 4.2): se asocian a los roles semilla "Dev" y "QA"
    // si todavía existen con ese nombre; si el tenant ya los renombró, quedan sin rol
    // asignado (rolId: null) y se completan luego vía PUT columnas-check.
    const [rolDev, rolQA] = await Promise.all([
      Rol.findOne({ tenantId, nombre: 'Dev' }),
      Rol.findOne({ tenantId, nombre: 'QA' }),
    ]);
    columnasCheck = [
      { nombre: 'Desarrollo', tipo: 'finalizado', rolId: rolDev ? rolDev._id : null },
      { nombre: 'QA', tipo: 'aprobacion', rolId: rolQA ? rolQA._id : null },
    ];
  }

  const proyecto = await Proyecto.create({
    tenantId,
    nombre,
    descripcion: descripcion || '',
    proyectoBaseId: proyectoBaseIdValidado,
    columnasCheck,
    equipo: equipoClonado,
  });

  return proyectoPublico(proyecto);
}

async function actualizar(tenantId, proyectoId, { nombre, descripcion }) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');

  if (nombre !== undefined) {
    validarLongitudMax(nombre, 'nombre', 100);
    proyecto.nombre = nombre;
  }
  if (descripcion !== undefined) {
    validarLongitudMax(descripcion, 'descripcion', 1000);
    proyecto.descripcion = descripcion;
  }

  await proyecto.save();
  return proyectoPublico(proyecto);
}

async function eliminar(tenantId, proyectoId) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');

  proyecto.activo = false;
  await proyecto.save();
  return proyectoPublico(proyecto);
}

async function actualizarEquipo(tenantId, proyectoId, { equipo }, usuarioId) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');

  if (!Array.isArray(equipo)) throw new ApiError(400, 'equipo debe ser un arreglo');

  const usuarioIdsVistos = new Set();
  for (const miembro of equipo) {
    if (!miembro || typeof miembro !== 'object') {
      throw new ApiError(400, 'cada miembro del equipo debe ser un objeto { usuarioId, rolId }');
    }
    stringParaFiltro(miembro.usuarioId, 'usuarioId');
    stringParaFiltro(miembro.rolId, 'rolId');
    if (!miembro.usuarioId || !miembro.rolId) {
      throw new ApiError(400, 'usuarioId y rolId son requeridos en cada miembro del equipo');
    }
    if (usuarioIdsVistos.has(miembro.usuarioId)) {
      throw new ApiError(400, 'un usuario no puede tener más de un rol en el mismo proyecto');
    }
    usuarioIdsVistos.add(miembro.usuarioId);
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const miembro of equipo) {
    // eslint-disable-next-line no-await-in-loop
    const [usuario, rol] = await Promise.all([
      Usuario.findOne({ _id: miembro.usuarioId, tenantId, activo: true }),
      Rol.findOne({ _id: miembro.rolId, tenantId }),
    ]);
    if (!usuario) throw new ApiError(400, `Usuario ${miembro.usuarioId} no existe en este tenant`);
    if (!rol) throw new ApiError(400, `Rol ${miembro.rolId} no existe en este tenant`);
  }

  proyecto.equipo = equipo.map((m) => ({ usuarioId: m.usuarioId, rolId: m.rolId }));
  await proyecto.save();
  await auditoriaService.registrar(
    tenantId,
    'proyecto',
    proyecto._id,
    'equipo_actualizado',
    usuarioId,
    `Equipo actualizado (${equipo.length} miembros)`,
  );
  return proyectoPublico(proyecto);
}

async function actualizarColumnasCheck(tenantId, proyectoId, { columnasCheck }) {
  const proyecto = await Proyecto.findOne({ _id: proyectoId, tenantId, activo: true });
  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado');

  if (!Array.isArray(columnasCheck) || columnasCheck.length === 0) {
    throw new ApiError(400, 'columnasCheck debe ser un arreglo con al menos un elemento');
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const columna of columnasCheck) {
    if (!columna || typeof columna !== 'object') {
      throw new ApiError(400, 'cada columna debe ser un objeto { nombre, tipo, rolId }');
    }
    if (!columna.nombre) throw new ApiError(400, 'nombre es requerido en cada columna');
    validarLongitudMax(columna.nombre, 'nombre de columna', 50);
    if (!TIPOS_COLUMNA_VALIDOS.includes(columna.tipo)) {
      throw new ApiError(400, `tipo de columna inválido: ${columna.tipo}`);
    }
    if (columna.rolId !== null && columna.rolId !== undefined) {
      stringParaFiltro(columna.rolId, 'rolId');
      // eslint-disable-next-line no-await-in-loop
      const rol = await Rol.findOne({ _id: columna.rolId, tenantId });
      if (!rol) throw new ApiError(400, `Rol ${columna.rolId} no existe en este tenant`);
    }
  }

  proyecto.columnasCheck = columnasCheck.map((c) => ({
    nombre: c.nombre,
    tipo: c.tipo,
    rolId: c.rolId || null,
  }));
  await proyecto.save();
  return proyectoPublico(proyecto);
}

module.exports = {
  listar,
  obtener,
  miembros,
  crear,
  actualizar,
  eliminar,
  actualizarEquipo,
  actualizarColumnasCheck,
};
