const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const Usuario = require('../models/Usuario');
const Rol = require('../models/Rol');
const { ApiError } = require('../middleware/errorHandler');
const { firmarToken } = require('./token.service');
const slugify = require('../utils/slugify');
const { validarEmail, validarLongitudMax } = require('../utils/validacion');

const ROLES_SEMILLA = [
  { nombre: 'Administrador', capacidades: ['gestionar_contenido', 'marcar_finalizado', 'aprobar_rechazar'] },
  { nombre: 'Dev', capacidades: ['marcar_finalizado'] },
  { nombre: 'QA', capacidades: ['aprobar_rechazar'] },
  { nombre: 'Lector', capacidades: ['solo_lectura'] },
];

// Hash dummy calculado una sola vez al arrancar. Se compara contra él cuando el tenant
// o el usuario no existen, para que el tiempo de respuesta del login no permita
// distinguir "no existe" de "password incorrecta" (mitigación de timing side-channel,
// ver auditoría de seguridad, Iteración 1).
const DUMMY_HASH = bcrypt.hashSync('valor-dummy-para-normalizar-tiempos-de-login', 10);

function usuarioPublico(usuario) {
  return {
    id: usuario._id,
    nombre: usuario.nombre,
    email: usuario.email,
    esAdmin: usuario.esAdmin,
  };
}

function tenantPublico(tenant) {
  return { id: tenant._id, nombre: tenant.nombre, slug: tenant.slug };
}

async function registrarTenant({ nombreTenant, nombreUsuario, email, password }) {
  if (!nombreTenant || !nombreUsuario || !email || !password) {
    throw new ApiError(400, 'nombreTenant, nombreUsuario, email y password son requeridos');
  }
  validarLongitudMax(nombreTenant, 'nombreTenant', 100);
  validarLongitudMax(nombreUsuario, 'nombreUsuario', 100);
  validarLongitudMax(email, 'email', 254);
  validarEmail(email);
  validarLongitudMax(password, 'password', 128);
  if (password.length < 8) {
    throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  // El email es único a nivel global (login lo resuelve sin pedir tenant), así que un
  // registro nuevo no puede reutilizar un email ya asociado a otro tenant.
  const emailExistente = await Usuario.findOne({ email: email.toLowerCase() });
  if (emailExistente) throw new ApiError(409, 'Ya existe una cuenta con ese email');

  const slug = slugify(nombreTenant) || 'tenant';
  if (await Tenant.exists({ slug })) {
    throw new ApiError(409, 'Ya existe una organización con ese nombre');
  }
  const tenant = await Tenant.create({ nombre: nombreTenant, slug });

  await Rol.insertMany(
    ROLES_SEMILLA.map((rol) => ({ ...rol, tenantId: tenant._id, esSemilla: true })),
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await Usuario.create({
    tenantId: tenant._id,
    nombre: nombreUsuario,
    email: email.toLowerCase(),
    passwordHash,
    esAdmin: true,
  });

  const token = firmarToken({
    tenantId: tenant._id.toString(),
    usuarioId: usuario._id.toString(),
  });

  return { token, tenant: tenantPublico(tenant), usuario: usuarioPublico(usuario) };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new ApiError(400, 'email y password son requeridos');
  }

  // El tenant se resuelve a partir del email (único global), no de un slug provisto aparte.
  const usuario = await Usuario.findOne({ email: email.toLowerCase(), activo: true });
  const tenant = usuario ? await Tenant.findById(usuario.tenantId) : null;

  // bcrypt.compare SIEMPRE se ejecuta (contra el hash real o el dummy), incluso si el
  // usuario o el tenant no existen — ver DUMMY_HASH arriba.
  const passwordValida = await bcrypt.compare(password, usuario ? usuario.passwordHash : DUMMY_HASH);

  if (!usuario || !tenant || !passwordValida) {
    throw new ApiError(401, 'Credenciales inválidas');
  }

  const token = firmarToken({
    tenantId: tenant._id.toString(),
    usuarioId: usuario._id.toString(),
  });

  return { token, tenant: tenantPublico(tenant), usuario: usuarioPublico(usuario) };
}

module.exports = { registrarTenant, login };
