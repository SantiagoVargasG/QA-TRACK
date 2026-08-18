const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase } = require('./helpers/fixtures');

describe('proyectos: CRUD, admin de tenant, membresía y aislamiento', () => {
  let app;
  let base;
  let tokenAdminB;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant B', email: 'admin@b.com' });
    tokenAdminB = regB.body.token;
  });

  after(async () => {
    await entorno.detener();
  });

  it('crear proyecto requiere esAdmin (403 sin él, 401 sin token)', async () => {
    const sinAdmin = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ nombre: 'Proyecto X' });
    assert.equal(sinAdmin.status, 403);

    const sinToken = await request(app).post('/api/proyectos').send({ nombre: 'Proyecto X' });
    assert.equal(sinToken.status, 401);
  });

  it('crear proyecto como admin asocia las columnas de check por defecto a los roles semilla Dev/QA', async () => {
    const resp = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto QA Tracker', descripcion: 'desc' });
    assert.equal(resp.status, 201);

    const colDev = resp.body.columnasCheck.find((c) => c.nombre === 'Desarrollo');
    const colQA = resp.body.columnasCheck.find((c) => c.nombre === 'QA');
    assert.equal(colDev.rolId, String(base.roles.dev._id));
    assert.equal(colQA.rolId, String(base.roles.qa._id));

    // Retrocompatibilidad (post-MVP: agrupador ProyectoBase): un proyecto creado sin
    // proyectoBaseId se comporta exactamente igual que antes de que ese campo existiera.
    assert.equal(resp.body.proyectoBaseId, null);
    assert.equal(resp.body.proyectoBaseNombre, null);
  });

  it('un no-miembro (ni admin) recibe 404 al ver el proyecto; tras entrar al equipo, ve 200', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Membresía' });
    const proyectoId = proy.body.id;

    const antes = await request(app)
      .get(`/api/proyectos/${proyectoId}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(antes.status, 404);

    await request(app)
      .put(`/api/proyectos/${proyectoId}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) }] });

    const despues = await request(app)
      .get(`/api/proyectos/${proyectoId}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(despues.status, 200);

    const forastero = await request(app)
      .get(`/api/proyectos/${proyectoId}`)
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.equal(forastero.status, 404);
  });

  it('cross-tenant: un admin de otro tenant recibe 404 (no 403) al intentar ver el proyecto', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Cross Tenant' });

    const resp = await request(app)
      .get(`/api/proyectos/${proy.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    assert.equal(resp.status, 404);
  });

  it('listar proyectos no incluye proyectos donde el usuario no es miembro ni admin', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Invisible Para Forastero' });

    const lista = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.ok(!lista.body.some((p) => p.id === proy.body.id));
  });

  it('id malformado -> 400', async () => {
    const resp = await request(app)
      .get('/api/proyectos/no-es-un-objectid')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(resp.status, 400);
  });

  it('actualizar/eliminar/columnas-check requieren esAdmin, no capacidad de rol', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Admin Only' });
    await request(app)
      .put(`/api/proyectos/${proy.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) }] });

    const put = await request(app)
      .put(`/api/proyectos/${proy.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(put.status, 403);

    const colCheck = await request(app)
      .put(`/api/proyectos/${proy.body.id}/columnas-check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columnasCheck: [{ nombre: 'Desarrollo', tipo: 'finalizado', rolId: null }] });
    assert.equal(colCheck.status, 403);

    const del = await request(app)
      .delete(`/api/proyectos/${proy.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(del.status, 403);
  });

  it('equipo: rechaza usuarioId duplicado, usuario/rol de otro tenant', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Validación Equipo' });

    const duplicado = await request(app)
      .put(`/api/proyectos/${proy.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({
        equipo: [
          { usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) },
          { usuarioId: base.usuarios.dev.id, rolId: String(base.roles.qa._id) },
        ],
      });
    assert.equal(duplicado.status, 400);

    const regB = await registrarTenant(app, { nombreTenant: 'ParaRolAjeno', email: 'admin@rolajeno.com' });
    const rolesB = await request(app).get('/api/roles').set('Authorization', `Bearer ${regB.body.token}`);
    const rolAjeno = await request(app)
      .put(`/api/proyectos/${proy.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: base.usuarios.dev.id, rolId: rolesB.body[0].id }] });
    assert.equal(rolAjeno.status, 400);

    const usuarioAjeno = await request(app)
      .put(`/api/proyectos/${proy.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: regB.body.usuario.id, rolId: String(base.roles.dev._id) }] });
    assert.equal(usuarioAjeno.status, 400);
  });

  it('rolId/usuarioId con formato no-ObjectId en el body -> 400 (CastError mapeado), no 500', async () => {
    const proy = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto CastError' });

    const colCheck = await request(app)
      .put(`/api/proyectos/${proy.body.id}/columnas-check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columnasCheck: [{ nombre: 'Desarrollo', tipo: 'finalizado', rolId: 'esto-no-es-un-objectid' }] });
    assert.equal(colCheck.status, 400);

    const equipo = await request(app)
      .put(`/api/proyectos/${proy.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: 'tambien-invalido', rolId: 'tambien-invalido' }] });
    assert.equal(equipo.status, 400);
  });
});
