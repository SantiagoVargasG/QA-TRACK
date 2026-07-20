const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('requerimientos: CRUD, capacidad gestionar_contenido y aislamiento', () => {
  let app;
  let base;
  let proyectoId;
  let moduloId;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    ({ proyectoId } = await crearProyectoConEquipo(app, base));
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Pedidos' });
    moduloId = modulo.body.id;
  });

  after(async () => {
    await entorno.detener();
  });

  it('crear requerimiento: 403 con rol sin gestionar_contenido, 201 con esAdmin', async () => {
    const sinPermiso = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ titulo: 'Alta de pedido', descripcionResumida: 'Permite crear pedidos' });
    assert.equal(sinPermiso.status, 403);

    const resp = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Alta de pedido', descripcionResumida: 'Permite crear pedidos' });
    assert.equal(resp.status, 201);
  });

  it('descripcionResumida > 500 caracteres -> 400', async () => {
    const resp = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'X', descripcionResumida: 'a'.repeat(501) });
    assert.equal(resp.status, 400);
  });

  it('titulo o descripcionResumida faltantes -> 400', async () => {
    const resp = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Solo título' });
    assert.equal(resp.status, 400);
  });

  it('actualizar/eliminar con rol sin gestionar_contenido -> 403', async () => {
    const req = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Para permisos', descripcionResumida: 'desc' });

    const put = await request(app)
      .put(`/api/modulos/${moduloId}/requerimientos/${req.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ titulo: 'Hackeado' });
    assert.equal(put.status, 403);

    const del = await request(app)
      .delete(`/api/modulos/${moduloId}/requerimientos/${req.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`);
    assert.equal(del.status, 403);
  });

  it('un requerimiento real con un moduloId de la URL que no le pertenece -> 404', async () => {
    const req = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Del modulo correcto', descripcionResumida: 'desc' });
    const otroModulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Otro Modulo' });

    const resp = await request(app)
      .put(`/api/modulos/${otroModulo.body.id}/requerimientos/${req.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Hackeado' });
    assert.equal(resp.status, 404);
  });

  it('un forastero (fuera del equipo) recibe 404 al listar requerimientos', async () => {
    const resp = await request(app)
      .get(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.equal(resp.status, 404);
  });

  it('moduloId inyectado con operador Mongo en la URL -> 400, no 500', async () => {
    const resp = await request(app)
      .get(`/api/modulos/${encodeURIComponent(JSON.stringify({ $ne: null }))}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(resp.status, 400);
  });

  it('cross-tenant: admin de otro tenant recibe 404', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Req B', email: 'admin@reqb.com' });
    const resp = await request(app)
      .get(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(resp.status, 404);
  });

  it('soft-delete: el requerimiento eliminado desaparece del listado', async () => {
    const req = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Para borrar', descripcionResumida: 'desc' });
    await request(app)
      .delete(`/api/modulos/${moduloId}/requerimientos/${req.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);

    const lista = await request(app)
      .get(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(!lista.body.some((r) => r.id === req.body.id));
  });
});
