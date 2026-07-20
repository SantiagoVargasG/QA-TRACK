const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearUsuario, login } = require('./helpers/fixtures');

describe('roles: CRUD, validación de capacidades y aislamiento de tenant', () => {
  let app;
  let tokenAdmin;
  let tenantSlug;

  before(async () => {
    app = await entorno.iniciar();
    const reg = await registrarTenant(app, { nombreTenant: 'RolesTenant', email: 'admin@roles.com' });
    tokenAdmin = reg.body.token;
    tenantSlug = reg.body.tenant.slug;
  });

  after(async () => {
    await entorno.detener();
  });

  it('sin token -> 401; con token no-admin -> 403', async () => {
    const sinToken = await request(app).get('/api/roles');
    assert.equal(sinToken.status, 401);

    await crearUsuario(app, tokenAdmin, { email: 'noadmin@roles.com' });
    const tokenNoAdmin = await login(app, tenantSlug, 'noadmin@roles.com');
    const resp = await request(app).get('/api/roles').set('Authorization', `Bearer ${tokenNoAdmin}`);
    assert.equal(resp.status, 403);
  });

  it('crear rol con capacidad inválida -> 400', async () => {
    const resp = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Custom', capacidades: ['capacidad-que-no-existe'] });
    assert.equal(resp.status, 400);
  });

  it('crear rol con nombre duplicado en el mismo tenant -> 400', async () => {
    const primero = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'UAT Cliente', capacidades: ['solo_lectura'] });
    assert.equal(primero.status, 201);

    const duplicado = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'UAT Cliente', capacidades: [] });
    assert.equal(duplicado.status, 400);
  });

  it('no se puede eliminar un rol semilla', async () => {
    const roles = await request(app).get('/api/roles').set('Authorization', `Bearer ${tokenAdmin}`);
    const rolSemilla = roles.body.find((r) => r.esSemilla);
    const resp = await request(app)
      .delete(`/api/roles/${rolSemilla.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(resp.status, 400);
  });

  it('un rol no-semilla creado por el tenant sí puede eliminarse', async () => {
    const creado = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Efímero', capacidades: [] });
    const resp = await request(app)
      .delete(`/api/roles/${creado.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert.equal(resp.status, 200);
  });

  it('roles de otro tenant no son visibles ni editables (404)', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'OtroTenantRoles', email: 'admin@otro.com' });
    const rolesB = await request(app).get('/api/roles').set('Authorization', `Bearer ${regB.body.token}`);
    const rolBId = rolesB.body[0].id;

    const resp = await request(app)
      .put(`/api/roles/${rolBId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(resp.status, 404);
  });

  it('id malformado -> 400', async () => {
    const resp = await request(app)
      .put('/api/roles/no-es-un-objectid')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'X' });
    assert.equal(resp.status, 400);
  });
});
