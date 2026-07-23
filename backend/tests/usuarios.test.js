const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearUsuario, login } = require('./helpers/fixtures');

describe('usuarios: CRUD, permisos y aislamiento de tenant', () => {
  let app;
  let tokenAdminA;
  let tenantAId;
  let tokenAdminB;

  before(async () => {
    app = await entorno.iniciar();
    const regA = await registrarTenant(app, { nombreTenant: 'Tenant A', email: 'admin@a.com' });
    tokenAdminA = regA.body.token;
    tenantAId = regA.body.tenant.id;

    const regB = await registrarTenant(app, { nombreTenant: 'Tenant B', email: 'admin@b.com' });
    tokenAdminB = regB.body.token;
  });

  after(async () => {
    await entorno.detener();
  });

  it('sin token -> 401; con token no-admin -> 403', async () => {
    const sinToken = await request(app).get('/api/usuarios');
    assert.equal(sinToken.status, 401);

    const noAdmin = await crearUsuario(app, tokenAdminA, { email: 'noadmin@a.com' });
    const tokenNoAdmin = await login(app, 'noadmin@a.com');
    const resp = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenNoAdmin}`);
    assert.equal(resp.status, 403);
    assert.equal(noAdmin.status, 201);
  });

  it('crear usuario: valida email, longitud de password y duplicados (email único global)', async () => {
    const emailInvalido = await crearUsuario(app, tokenAdminA, { email: 'no-es-email' });
    assert.equal(emailInvalido.status, 400);

    const passwordCorta = await crearUsuario(app, tokenAdminA, { email: 'x@a.com', password: '123' });
    assert.equal(passwordCorta.status, 400);

    const ok = await crearUsuario(app, tokenAdminA, { email: 'duplicado@a.com' });
    assert.equal(ok.status, 201);
    const duplicado = await crearUsuario(app, tokenAdminA, { email: 'duplicado@a.com' });
    assert.equal(duplicado.status, 409);
  });

  it('esAdmin como string "false" se rechaza (nunca Boolean(valorDeCliente))', async () => {
    const resp = await crearUsuario(app, tokenAdminA, { email: 'boolstring@a.com', esAdmin: 'false' });
    assert.equal(resp.status, 400);
  });

  it('un email no puede repetirse en tenants distintos: el login lo resuelve globalmente', async () => {
    const enA = await crearUsuario(app, tokenAdminA, { email: 'compartido@x.com' });
    const enB = await crearUsuario(app, tokenAdminB, { email: 'compartido@x.com' });
    assert.equal(enA.status, 201);
    assert.equal(enB.status, 409);
  });

  it('listar usuarios no filtra por tenantId de cliente: cada tenant solo ve el suyo', async () => {
    const listaA = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenAdminA}`);
    const listaB = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenAdminB}`);
    assert.ok(listaA.body.every((u) => !u.email.endsWith('@b.com')));
    assert.ok(listaB.body.every((u) => !u.email.endsWith('@a.com')));
  });

  it('actualizar/eliminar un usuario de OTRO tenant -> 404 (no revela existencia)', async () => {
    const deB = await crearUsuario(app, tokenAdminB, { email: 'soloB@b.com' });
    const put = await request(app)
      .put(`/api/usuarios/${deB.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(put.status, 404);

    const del = await request(app)
      .delete(`/api/usuarios/${deB.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    assert.equal(del.status, 404);
  });

  it('id malformado -> 400, no 500', async () => {
    const resp = await request(app)
      .put('/api/usuarios/no-es-un-objectid')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nombre: 'X' });
    assert.equal(resp.status, 400);
  });

  it('regla de último admin: no se puede desactivar, degradar ni eliminar al único admin activo', async () => {
    const reg = await registrarTenant(app, { nombreTenant: 'SoloAdmin', email: 'unico@solo.com' });
    const token = reg.body.token;
    const idUnico = reg.body.usuario.id;

    const desactivar = await request(app)
      .put(`/api/usuarios/${idUnico}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false });
    assert.equal(desactivar.status, 400);

    const degradar = await request(app)
      .put(`/api/usuarios/${idUnico}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ esAdmin: false });
    assert.equal(degradar.status, 400);

    const eliminar = await request(app)
      .delete(`/api/usuarios/${idUnico}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(eliminar.status, 400);
  });

  it('con un segundo admin activo, sí se puede degradar/desactivar al primero', async () => {
    const reg = await registrarTenant(app, { nombreTenant: 'DosAdmins', email: 'admin1@dos.com' });
    const token = reg.body.token;
    const segundo = await crearUsuario(app, token, { email: 'admin2@dos.com', esAdmin: true });
    assert.equal(segundo.status, 201);

    const degradar = await request(app)
      .put(`/api/usuarios/${reg.body.usuario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ esAdmin: false });
    assert.equal(degradar.status, 200);
  });
});
