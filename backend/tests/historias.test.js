const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('historias: código HU-N, CRUD, capacidad gestionar_contenido y aislamiento', () => {
  let app;
  let base;
  let proyectoId;
  let requerimientoId;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    ({ proyectoId } = await crearProyectoConEquipo(app, base));
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Pedidos' });
    const req = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Alta de pedido', descripcionResumida: 'desc' });
    requerimientoId = req.body.id;
  });

  after(async () => {
    await entorno.detener();
  });

  it('el código HU-N es correlativo por proyecto y nunca se reutiliza tras un soft-delete', async () => {
    const h1 = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Como usuario quiero crear un pedido' });
    assert.equal(h1.body.codigo, 'HU-1');

    const h2 = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Como usuario quiero cancelar un pedido' });
    assert.equal(h2.body.codigo, 'HU-2');

    await request(app)
      .delete(`/api/requerimientos/${requerimientoId}/historias/${h2.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);

    const h3 = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Como usuario quiero ver el historial de pedidos' });
    assert.equal(h3.body.codigo, 'HU-3', 'el código de la historia borrada (HU-2) no debe reutilizarse');
  });

  it('dos historias creadas EN PARALELO en el mismo proyecto reciben códigos HU-N distintos', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Módulo concurrencia' });
    const req = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Requerimiento concurrencia', descripcionResumida: 'desc' });

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/requerimientos/${req.body.id}/historias`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ texto: 'Historia concurrente A' }),
      request(app)
        .post(`/api/requerimientos/${req.body.id}/historias`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ texto: 'Historia concurrente B' }),
    ]);

    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(
      a.body.codigo,
      b.body.codigo,
      `dos historias no pueden compartir el mismo código HU-N (obtuve A=${a.body.codigo} B=${b.body.codigo})`,
    );
  });

  it('texto requerido y con longitud máxima de 1000 caracteres', async () => {
    const sinTexto = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({});
    assert.equal(sinTexto.status, 400);

    const muyLargo = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'a'.repeat(1001) });
    assert.equal(muyLargo.status, 400);
  });

  it('actualizar/eliminar con rol sin gestionar_contenido -> 403', async () => {
    const h = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Para permisos' });

    const put = await request(app)
      .put(`/api/requerimientos/${requerimientoId}/historias/${h.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ texto: 'Hackeado' });
    assert.equal(put.status, 403);

    const del = await request(app)
      .delete(`/api/requerimientos/${requerimientoId}/historias/${h.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`);
    assert.equal(del.status, 403);
  });

  it('una historia real con un requerimientoId de la URL que no le pertenece -> 404', async () => {
    const h = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Del requerimiento correcto' });
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Otro módulo para mismatch' });
    const otroReq = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Otro requerimiento', descripcionResumida: 'desc' });

    const resp = await request(app)
      .put(`/api/requerimientos/${otroReq.body.id}/historias/${h.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Hackeado' });
    assert.equal(resp.status, 404);
  });

  it('cross-tenant: admin de otro tenant recibe 404', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Hist B', email: 'admin@histb.com' });
    const resp = await request(app)
      .get(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(resp.status, 404);
  });

  it('soft-delete: la historia eliminada desaparece del listado', async () => {
    const h = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Para borrar' });
    await request(app)
      .delete(`/api/requerimientos/${requerimientoId}/historias/${h.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);

    const lista = await request(app)
      .get(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(!lista.body.some((x) => x.id === h.body.id));
  });
});
