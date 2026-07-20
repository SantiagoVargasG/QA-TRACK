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

async function generarSlugUnico(nombre) {
  const base = slugify(nombre) || 'tenant';
  let slug = base;
  let sufijo = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Tenant.exists({ slug })) {
    sufijo += 1;
    slug = `${base}-${sufijo}`;
  }
  return slug;
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

  const slug = await generarSlugUnico(nombreTenant);
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

async function login({ tenantSlug, email, password }) {
  if (!tenantSlug || !email || !password) {
    throw new ApiError(400, 'tenantSlug, email y password son requeridos');
  }

  const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
  const usuario = tenant
    ? await Usuario.findOne({ tenantId: tenant._id, email: email.toLowerCase(), activo: true })
    : null;

  // bcrypt.compare SIEMPRE se ejecuta (contra el hash real o el dummy), incluso si el
  // tenant o el usuario no existen — ver DUMMY_HASH arriba.
  const passwordValida = await bcrypt.compare(password, usuario ? usuario.passwordHash : DUMMY_HASH);

  if (!tenant || !usuario || !passwordValida) {
    throw new ApiError(401, 'Credenciales inválidas');
  }

  const token = firmarToken({
    tenantId: tenant._id.toString(),
    usuarioId: usuario._id.toString(),
  });

  return { token, tenant: tenantPublico(tenant), usuario: usuarioPublico(usuario) };
}

module.exports = { registrarTenant, login };
