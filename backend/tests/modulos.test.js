const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('modulos: CRUD, reordenar, capacidad gestionar_contenido y aislamiento', () => {
  let app;
  let base;
  let proyectoId;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    ({ proyectoId } = await crearProyectoConEquipo(app, base));
  });

  after(async () => {
    await entorno.detener();
  });

  it('crear módulo: 403 sin gestionar_contenido (Lector y Dev), 401 sin token, 201 con esAdmin', async () => {
    const conLector = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.lector}`)
      .send({ nombre: 'Catalogo' });
    assert.equal(conLector.status, 403);

    const conDev = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ nombre: 'Catalogo' });
    assert.equal(conDev.status, 403);

    const sinToken = await request(app).post(`/api/proyectos/${proyectoId}/modulos`).send({ nombre: 'Catalogo' });
    assert.equal(sinToken.status, 401);

    const conAdmin = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Catalogo', icono: 'carpeta', descripcion: 'Modulo de catalogo' });
    assert.equal(conAdmin.status, 201);
  });

  it('valida nombre requerido e icono contra el set predefinido', async () => {
    const sinNombre = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ icono: 'carpeta' });
    assert.equal(sinNombre.status, 400);

    const iconoInvalido = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Otro', icono: 'icono-que-no-existe' });
    assert.equal(iconoInvalido.status, 400);
  });

  it('un Lector (solo_lectura) puede listar módulos aunque no pueda crearlos', async () => {
    const resp = await request(app)
      .get(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.lector}`);
    assert.equal(resp.status, 200);
  });

  it('actualizar/eliminar módulo con rol sin gestionar_contenido -> 403', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Para permisos' });

    const put = await request(app)
      .put(`/api/proyectos/${proyectoId}/modulos/${modulo.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(put.status, 403);

    const del = await request(app)
      .delete(`/api/proyectos/${proyectoId}/modulos/${modulo.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`);
    assert.equal(del.status, 403);
  });

  it('reordenar exige exactamente el mismo conjunto de módulos activos del proyecto', async () => {
    const m1 = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Reorden A' });
    const m2 = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Reorden B' });

    const subconjunto = await request(app)
      .put(`/api/proyectos/${proyectoId}/modulos/reordenar`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ ids: [m1.body.id] });
    assert.equal(subconjunto.status, 400);

    const tipoInvalido = await request(app)
      .put(`/api/proyectos/${proyectoId}/modulos/reordenar`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ ids: [{ $ne: null }, m1.body.id, m2.body.id] });
    assert.equal(tipoInvalido.status, 400, 'un id no-string no debe colarse como operador de Mongo ni causar 500');

    const listaAntes = await request(app)
      .get(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const todosLosIds = listaAntes.body.map((m) => m.id);
    const reordenados = [...todosLosIds].reverse();
    const ok = await request(app)
      .put(`/api/proyectos/${proyectoId}/modulos/reordenar`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ ids: reordenados });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.map((m) => m.id), reordenados);
  });

  it('un moduloId real con un proyectoId de la URL que no le pertenece -> 404', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Del proyecto correcto' });
    const otroProyecto = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Otro Proyecto' });

    const resp = await request(app)
      .put(`/api/proyectos/${otroProyecto.body.id}/modulos/${modulo.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(resp.status, 404);
  });

  it('soft-delete: el módulo eliminado desaparece del listado', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Para borrar' });
    await request(app)
      .delete(`/api/proyectos/${proyectoId}/modulos/${modulo.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);

    const lista = await request(app)
      .get(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(!lista.body.some((m) => m.id === modulo.body.id));
  });

  it('cross-tenant: admin de otro tenant recibe 404 al listar módulos', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Modulos B', email: 'admin@modb.com' });
    const resp = await request(app)
      .get(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(resp.status, 404);
  });
});
