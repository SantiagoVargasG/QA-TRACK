const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { ApiError } = require('../middleware/errorHandler');
const { validarEmail, validarLongitudMax, booleanoOpcional } = require('../utils/validacion');

function usuarioPublico(usuario) {
  return {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    esAdmin: usuario.esAdmin,
    activo: usuario.activo,
  };
}

// Cuenta administradores activos del tenant, excluyendo al propio usuario afectado por
// la operación en curso — usado por el guard de "último admin" en actualizar/eliminar.
async function contarAdminsActivosExcluyendo(tenantId, idExcluir) {
  return Usuario.countDocuments({ tenantId, esAdmin: true, activo: true, _id: { $ne: idExcluir } });
}

async function listar(tenantId) {
  const usuarios = await Usuario.find({ tenantId }).sort({ createdAt: 1 });
  return usuarios.map(usuarioPublico);
}

async function crear(tenantId, { nombre, email, password, esAdmin }) {
  if (!nombre || !email || !password) {
    throw new ApiError(400, 'nombre, email y password son requeridos');
  }
  validarLongitudMax(nombre, 'nombre', 100);
  validarLongitudMax(email, 'email', 254);
  validarEmail(email);
  validarLongitudMax(password, 'password', 128);
  if (password.length < 8) {
    throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
  }
  const esAdminValidado = booleanoOpcional(esAdmin, 'esAdmin') ?? false;

  const existente = await Usuario.findOne({ tenantId, email: email.toLowerCase() });
  if (existente) {
    throw new ApiError(400, 'Ya existe un usuario con ese email en este tenant');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({
    tenantId,
    nombre,
    email: email.toLowerCase(),
    passwordHash,
    esAdmin: esAdminValidado,
  });

  return usuarioPublico(usuario);
}

async function actualizar(tenantId, id, { nombre, esAdmin, activo, password }) {
  const usuario = await Usuario.findOne({ _id: id, tenantId });
  if (!usuario) throw new ApiError(404, 'Usuario no encontrado');

  const esAdminValidado = booleanoOpcional(esAdmin, 'esAdmin');
  const activoValidado = booleanoOpcional(activo, 'activo');

  // Guard de "último admin": si esta operación haría que el usuario deje de contar como
  // admin activo (lo desactivan, lo degradan, o ambas), y era el único admin activo del
  // tenant, se rechaza. Cubre eliminar, desactivar (activo:false) y degradar (esAdmin:false).
  const eraAdminActivo = usuario.esAdmin && usuario.activo;
  const nuevoEsAdmin = esAdminValidado !== undefined ? esAdminValidado : usuario.esAdmin;
  const nuevoActivo = activoValidado !== undefined ? activoValidado : usuario.activo;
  const seguiraAdminActivo = nuevoEsAdmin && nuevoActivo;

  if (eraAdminActivo && !seguiraAdminActivo) {
    const otrosAdmins = await contarAdminsActivosExcluyendo(tenantId, usuario._id);
    if (otrosAdmins === 0) {
      throw new ApiError(400, 'No se puede quitar al último administrador activo del tenant');
    }
  }

  if (nombre !== undefined) {
    validarLongitudMax(nombre, 'nombre', 100);
    usuario.nombre = nombre;
  }
  if (esAdminValidado !== undefined) usuario.esAdmin = esAdminValidado;
  if (activoValidado !== undefined) usuario.activo = activoValidado;
  if (password) {
    validarLongitudMax(password, 'password', 128);
    if (password.length < 8) throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
    usuario.passwordHash = await bcrypt.hash(password, 10);
  }

  await usuario.save();
  return usuarioPublico(usuario);
}

async function eliminar(tenantId, id) {
  const usuario = await Usuario.findOne({ _id: id, tenantId });
  if (!usuario) throw new ApiError(404, 'Usuario no encontrado');

  if (usuario.esAdmin && usuario.activo) {
    const otrosAdmins = await contarAdminsActivosExcluyendo(tenantId, usuario._id);
    if (otrosAdmins === 0) {
      throw new ApiError(400, 'No se puede eliminar al último administrador activo del tenant');
    }
  }

  usuario.activo = false;
  await usuario.save();
  return usuarioPublico(usuario);
}

module.exports = { listar, crear, actualizar, eliminar };
