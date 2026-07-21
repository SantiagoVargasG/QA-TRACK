const Proyecto = require('../models/Proyecto');
const Usuario = require('../models/Usuario');
const Rol = require('../models/Rol');
const { ApiError } = require('../middleware/errorHandler');
const { validarLongitudMax, stringParaFiltro } = require('../utils/validacion');
const { cargarProyectoConAcceso } = require('./acceso.service');
const auditoriaService = require('./auditoria.service');

const TIPOS_COLUMNA_VALIDOS = ['finalizado', 'aprobacion'];

function proyectoPublico(proyecto) {
  return {
    id: proyecto._id,
    nombre: proyecto.nombre,
    descripcion: proyecto.descripcion,
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
  return proyectos.map(proyectoPublico);
}

async function obtener(tenantId, proyectoId, auth) {
  const proyecto = await cargarProyectoConAcceso(tenantId, proyectoId, auth);
  return proyectoPublico(proyecto);
}

async function crear(tenantId, { nombre, descripcion }) {
  if (!nombre) throw new ApiError(400, 'nombre es requerido');
  validarLongitudMax(nombre, 'nombre', 100);
  if (descripcion !== undefined) validarLongitudMax(descripcion, 'descripcion', 1000);

  // Columnas de check por defecto (PRD 4.2): se asocian a los roles semilla "Dev" y "QA"
  // si todavía existen con ese nombre; si el tenant ya los renombró, quedan sin rol
  // asignado (rolId: null) y se completan luego vía PUT columnas-check.
  const [rolDev, rolQA] = await Promise.all([
    Rol.findOne({ tenantId, nombre: 'Dev' }),
    Rol.findOne({ tenantId, nombre: 'QA' }),
  ]);

  const proyecto = await Proyecto.create({
    tenantId,
    nombre,
    descripcion: descripcion || '',
    columnasCheck: [
      { nombre: 'Desarrollo', tipo: 'finalizado', rolId: rolDev ? rolDev._id : null },
      { nombre: 'QA', tipo: 'aprobacion', rolId: rolQA ? rolQA._id : null },
    ],
    equipo: [],
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
  crear,
  actualizar,
  eliminar,
  actualizarEquipo,
  actualizarColumnasCheck,
};
