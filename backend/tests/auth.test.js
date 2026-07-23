const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const entorno = require('./helpers/entorno');
const { registrarTenant, login, crearUsuario } = require('./helpers/fixtures');

describe('auth: registro de tenant y login', () => {
  let app;

  before(async () => {
    app = await entorno.iniciar();
  });

  after(async () => {
    await entorno.detener();
  });

  it('registra un tenant nuevo con sus 4 roles semilla y su primer usuario como admin', async () => {
    const resp = await registrarTenant(app, { nombreTenant: 'Acme', email: 'admin@acme.com' });
    assert.equal(resp.status, 201);
    assert.equal(resp.body.usuario.esAdmin, true);
    assert.equal(resp.body.tenant.slug, 'acme');

    const Rol = mongoose.model('Rol');
    const roles = await Rol.find({ tenantId: resp.body.tenant.id });
    assert.equal(roles.length, 4);
    assert.deepEqual(
      roles.map((r) => r.nombre).sort(),
      ['Administrador', 'Dev', 'Lector', 'QA'],
    );
  });

  it('rechaza con 409 un nombre de organización ya usado, en vez de generar un slug con sufijo', async () => {
    const r1 = await registrarTenant(app, { nombreTenant: 'Colisión', email: 'a1@colision.com' });
    assert.equal(r1.status, 201);
    const r2 = await registrarTenant(app, { nombreTenant: 'Colisión', email: 'a2@colision.com' });
    assert.equal(r2.status, 409);
  });

  it('rechaza con 409 un email ya usado por otro tenant (email es único global)', async () => {
    const r1 = await registrarTenant(app, { nombreTenant: 'EmailGlobalA', email: 'repetido@global.com' });
    assert.equal(r1.status, 201);
    const r2 = await registrarTenant(app, { nombreTenant: 'EmailGlobalB', email: 'repetido@global.com' });
    assert.equal(r2.status, 409);
  });

  it('rechaza registro con campos requeridos faltantes', async () => {
    const resp = await request(app)
      .post('/api/auth/registro-tenant')
      .send({ nombreTenant: 'X' });
    assert.equal(resp.status, 400);
  });

  it('rechaza registro con email inválido', async () => {
    const resp = await registrarTenant(app, { nombreTenant: 'MailInvalido', email: 'no-es-un-email' });
    assert.equal(resp.status, 400);
  });

  it('rechaza registro con password menor a 8 caracteres', async () => {
    const resp = await registrarTenant(app, {
      nombreTenant: 'PassCorta',
      email: 'passcorta@x.com',
      password: '1234567',
    });
    assert.equal(resp.status, 400);
  });

  it('login exitoso con credenciales correctas', async () => {
    await registrarTenant(app, { nombreTenant: 'LoginOk', email: 'ok@loginok.com' });
    const resp = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ok@loginok.com', password: 'password123' });
    assert.equal(resp.status, 200);
    assert.ok(resp.body.token);
  });

  it('login con usuario inexistente y password incorrecta devuelven el mismo 401 genérico', async () => {
    await registrarTenant(app, { nombreTenant: 'Timing', email: 'real@timing.com' });

    const usuarioInexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@timing.com', password: 'password123' });
    const passwordIncorrecta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@timing.com', password: 'password-incorrecta' });

    assert.equal(usuarioInexistente.status, 401);
    assert.equal(passwordIncorrecta.status, 401);
    assert.equal(usuarioInexistente.body.error, passwordIncorrecta.body.error);
  });

  it('un usuario desactivado no puede loguearse aunque la password sea correcta', async () => {
    const reg = await registrarTenant(app, { nombreTenant: 'Desactivado', email: 'admin@desact.com' });
    const nuevo = await crearUsuario(app, reg.body.token, { email: 'inactivo@desact.com' });

    const antesDeDesactivar = await login(app, 'inactivo@desact.com');
    assert.ok(antesDeDesactivar, 'debería poder loguearse mientras está activo');

    await request(app)
      .put(`/api/usuarios/${nuevo.body.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ activo: false });

    const resp = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactivo@desact.com', password: 'password123' });
    assert.equal(resp.status, 401);
  });
});

describe('auth: verificación de JWT en requireAuth', () => {
  let app;
  let token;

  before(async () => {
    app = await entorno.iniciar();
    const reg = await registrarTenant(app, { nombreTenant: 'JWT Test', email: 'admin@jwt.com' });
    token = reg.body.token;
  });

  after(async () => {
    await entorno.detener();
  });

  it('sin token -> 401', async () => {
    const resp = await request(app).get('/api/usuarios');
    assert.equal(resp.status, 401);
  });

  it('token malformado -> 401', async () => {
    const resp = await request(app).get('/api/usuarios').set('Authorization', 'Bearer token-invalido');
    assert.equal(resp.status, 401);
  });

  it('token firmado con alg:none es rechazado (nunca confiar en alg del header)', async () => {
    const payload = jwt.decode(token);
    const tokenInseguro = jwt.sign(payload, undefined, { algorithm: 'none' });
    const resp = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenInseguro}`);
    assert.equal(resp.status, 401);
  });

  it('token válido de un usuario luego desactivado deja de funcionar de inmediato (no espera expiración)', async () => {
    const reg = await registrarTenant(app, { nombreTenant: 'RevocaYa', email: 'admin@revoca.com' });
    const nuevo = await crearUsuario(app, reg.body.token, { email: 'sera-desactivado@revoca.com' });
    const tokenNuevo = await login(app, 'sera-desactivado@revoca.com');

    const antes = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenNuevo}`);
    assert.equal(antes.status, 403, 'usuario no-admin ve 403 (autenticado pero sin permiso), confirma que el token funciona');

    await request(app)
      .put(`/api/usuarios/${nuevo.body.id}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ activo: false });

    const despues = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenNuevo}`);
    assert.equal(despues.status, 401, 'el mismo JWT ya no debe autenticar tras desactivar al usuario en BD');
  });
});
