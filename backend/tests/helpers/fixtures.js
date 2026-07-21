const request = require('supertest');
const mongoose = require('mongoose');

async function registrarTenant(app, overrides = {}) {
  const datos = {
    nombreTenant: 'Tenant Demo',
    nombreUsuario: 'Admin Demo',
    email: 'admin@demo.com',
    password: 'password123',
    ...overrides,
  };
  return request(app).post('/api/auth/registro-tenant').send(datos);
}

async function login(app, tenantSlug, email, password = 'password123') {
  const resp = await request(app).post('/api/auth/login').send({ tenantSlug, email, password });
  return resp.body.token;
}

async function crearUsuario(app, token, overrides = {}) {
  const datos = {
    nombre: 'Usuario Demo',
    email: `usuario${Date.now()}${Math.random()}@demo.com`,
    password: 'password123',
    ...overrides,
  };
  return request(app).post('/api/usuarios').set('Authorization', `Bearer ${token}`).send(datos);
}

// Crea un tenant con un admin y tres usuarios (Dev, QA, Lector) ya logueados con los
// roles semilla correspondientes, más un usuario "forastero" que no pertenece a ningún
// equipo — set base reutilizado por los tests de proyectos/modulos/requerimientos/historias.
async function crearTenantConEquipoBase(app) {
  const reg = await registrarTenant(app);
  const tokenAdmin = reg.body.token;
  const tenantSlug = reg.body.tenant.slug;
  const tenantId = reg.body.tenant.id;

  const Rol = mongoose.model('Rol');
  const roles = await Rol.find({ tenantId });
  const rolDev = roles.find((r) => r.nombre === 'Dev');
  const rolQA = roles.find((r) => r.nombre === 'QA');
  const rolLector = roles.find((r) => r.nombre === 'Lector');

  const dev = (await crearUsuario(app, tokenAdmin, { nombre: 'Dev User', email: 'dev@demo.com' })).body;
  const qa = (await crearUsuario(app, tokenAdmin, { nombre: 'QA User', email: 'qa@demo.com' })).body;
  const lector = (await crearUsuario(app, tokenAdmin, { nombre: 'Lector User', email: 'lector@demo.com' })).body;
  const forastero = (
    await crearUsuario(app, tokenAdmin, { nombre: 'Forastero', email: 'forastero@demo.com' })
  ).body;

  const tokenDev = await login(app, tenantSlug, 'dev@demo.com');
  const tokenQA = await login(app, tenantSlug, 'qa@demo.com');
  const tokenLector = await login(app, tenantSlug, 'lector@demo.com');
  const tokenForastero = await login(app, tenantSlug, 'forastero@demo.com');

  return {
    tenantId,
    tenantSlug,
    tokenAdmin,
    roles: { dev: rolDev, qa: rolQA, lector: rolLector },
    usuarios: { admin: reg.body.usuario, dev, qa, lector, forastero },
    tokens: { admin: tokenAdmin, dev: tokenDev, qa: tokenQA, lector: tokenLector, forastero: tokenForastero },
  };
}

async function crearProyectoConEquipo(app, base) {
  const proy = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${base.tokens.admin}`)
    .send({ nombre: 'Proyecto Demo', descripcion: 'desc' });
  const proyectoId = proy.body.id;

  await request(app)
    .put(`/api/proyectos/${proyectoId}/equipo`)
    .set('Authorization', `Bearer ${base.tokens.admin}`)
    .send({
      equipo: [
        { usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) },
        { usuarioId: base.usuarios.qa.id, rolId: String(base.roles.qa._id) },
        { usuarioId: base.usuarios.lector.id, rolId: String(base.roles.lector._id) },
      ],
    });

  return { proyectoId, proyecto: proy.body };
}

module.exports = {
  registrarTenant,
  login,
  crearUsuario,
  crearTenantConEquipoBase,
  crearProyectoConEquipo,
};
