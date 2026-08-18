const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase } = require('./helpers/fixtures');

describe('proyectosBase: agrupador de sub-vistas (proyectos), CRUD admin, aislamiento y soft-delete', () => {
  let app;
  let base;
  let tokenAdminB;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Base B', email: 'admin@baseb.com' });
    tokenAdminB = regB.body.token;
  });

  after(async () => {
    await entorno.detener();
  });

  it('crear/listar/actualizar/eliminar requieren esAdmin (403 sin él, 401 sin token)', async () => {
    const crearSinAdmin = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ nombre: 'GoFixii' });
    assert.equal(crearSinAdmin.status, 403);

    const crearSinToken = await request(app).post('/api/proyectos-base').send({ nombre: 'GoFixii' });
    assert.equal(crearSinToken.status, 401);

    const listarSinAdmin = await request(app)
      .get('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(listarSinAdmin.status, 403);
  });

  it('CRUD básico: crear, listar, actualizar nombre', async () => {
    const crear = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'GoFixii' });
    assert.equal(crear.status, 201);
    assert.equal(crear.body.nombre, 'GoFixii');
    assert.equal(crear.body.activo, true);

    const listar = await request(app)
      .get('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(listar.status, 200);
    assert.ok(listar.body.some((b) => b.id === crear.body.id));

    const actualizar = await request(app)
      .put(`/api/proyectos-base/${crear.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'GoFixii Renombrado' });
    assert.equal(actualizar.status, 200);
    assert.equal(actualizar.body.nombre, 'GoFixii Renombrado');
  });

  it('nombre requerido y con longitud máxima', async () => {
    const sinNombre = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({});
    assert.equal(sinNombre.status, 400);

    const muyLargo = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'a'.repeat(101) });
    assert.equal(muyLargo.status, 400);
  });

  it('id malformado -> 400', async () => {
    const resp = await request(app)
      .put('/api/proyectos-base/no-es-un-objectid')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'x' });
    assert.equal(resp.status, 400);
  });

  it('cross-tenant: un admin de otro tenant no ve ni puede editar/eliminar la base (404)', async () => {
    const crear = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Cross Tenant Base' });

    const listar = await request(app)
      .get('/api/proyectos-base')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    assert.ok(!listar.body.some((b) => b.id === crear.body.id));

    const actualizar = await request(app)
      .put(`/api/proyectos-base/${crear.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ nombre: 'Hackeado' });
    assert.equal(actualizar.status, 404);

    const eliminar = await request(app)
      .delete(`/api/proyectos-base/${crear.body.id}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    assert.equal(eliminar.status, 404);
  });

  it('crear un proyecto (sub-vista) con proyectoBaseId lo agrupa; sin proyectoBaseId sigue suelto (retrocompatibilidad)', async () => {
    const crearBase = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'GoFixii Grupo' });
    const proyectoBaseId = crearBase.body.id;

    const subVista = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'GoFixii - Experto', proyectoBaseId });
    assert.equal(subVista.status, 201);
    assert.equal(subVista.body.proyectoBaseId, proyectoBaseId);

    const suelto = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Proyecto Suelto Retrocompat' });
    assert.equal(suelto.status, 201);
    assert.equal(suelto.body.proyectoBaseId, null);

    const listado = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const subVistaListada = listado.body.find((p) => p.id === subVista.body.id);
    const sueltoListado = listado.body.find((p) => p.id === suelto.body.id);
    assert.equal(subVistaListada.proyectoBaseNombre, 'GoFixii Grupo');
    assert.equal(sueltoListado.proyectoBaseId, null);
    assert.equal(sueltoListado.proyectoBaseNombre, null);
  });

  it('proyectoBaseId de otro tenant (o inexistente) -> 400 al crear el proyecto', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Base Ajena', email: 'admin@baseajena.com' });
    const baseAjena = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${regB.body.token}`)
      .send({ nombre: 'Base De Otro Tenant' });

    const conBaseAjena = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Intento Cross Tenant', proyectoBaseId: baseAjena.body.id });
    assert.equal(conBaseAjena.status, 400);

    const conBaseInexistente = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Intento Base Inexistente', proyectoBaseId: '507f1f77bcf86cd799439011' });
    assert.equal(conBaseInexistente.status, 400);
  });

  it('clonarDesdeProyectoId copia equipo y columnasCheck en vez de los defaults Dev/QA', async () => {
    const origen = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Origen Para Clonar' });
    await request(app)
      .put(`/api/proyectos/${origen.body.id}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ equipo: [{ usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) }] });
    await request(app)
      .put(`/api/proyectos/${origen.body.id}/columnas-check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columnasCheck: [{ nombre: 'Solo Una Columna', tipo: 'aprobacion', rolId: String(base.roles.qa._id) }] });

    const clon = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Clon De Origen', clonarDesdeProyectoId: origen.body.id });
    assert.equal(clon.status, 201);
    assert.equal(clon.body.equipo.length, 1);
    assert.equal(clon.body.equipo[0].usuarioId, base.usuarios.dev.id);
    assert.equal(clon.body.columnasCheck.length, 1);
    assert.equal(clon.body.columnasCheck[0].nombre, 'Solo Una Columna');
  });

  it('inactivar una base la oculta a ella y a sus sub-vistas del listado, SIN escribir activo:false en las sub-vistas; reactivar restaura ambas', async () => {
    const crearBase = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Base A Inactivar' });
    const proyectoBaseId = crearBase.body.id;

    const subVista = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Sub-vista De Base A Inactivar', proyectoBaseId });

    const listadoAntes = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(listadoAntes.body.some((p) => p.id === subVista.body.id), 'la sub-vista debe verse mientras la base está activa');

    const eliminar = await request(app)
      .delete(`/api/proyectos-base/${proyectoBaseId}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(eliminar.status, 200);
    assert.equal(eliminar.body.activo, false);

    // El listado de gestión (admin) SÍ sigue mostrando la base inactiva, con activo:false —
    // igual que usuarios, para que se la pueda encontrar y reactivar (ver test de abajo).
    const listadoBasesDespues = await request(app)
      .get('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const baseInactivaEnListado = listadoBasesDespues.body.find((b) => b.id === proyectoBaseId);
    assert.ok(baseInactivaEnListado, 'la base inactiva sigue apareciendo en el listado de gestión');
    assert.equal(baseInactivaEnListado.activo, false);

    const listadoProyectosDespues = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(
      !listadoProyectosDespues.body.some((p) => p.id === subVista.body.id),
      'la sub-vista debe ocultarse del listado cuando su base está inactiva',
    );

    // La sub-vista sigue siendo un Proyecto normal y activo por su cuenta: acceso directo
    // por id sigue funcionando (esto NO se bloquea, solo se oculta del listado agrupado).
    const accesoDirecto = await request(app)
      .get(`/api/proyectos/${subVista.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(accesoDirecto.status, 200);
    assert.equal(accesoDirecto.body.activo, true, 'inactivar la base no debe tocar el activo de la sub-vista');

    const reactivar = await request(app)
      .put(`/api/proyectos-base/${proyectoBaseId}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ activo: true });
    assert.equal(reactivar.status, 200);
    assert.equal(reactivar.body.activo, true);

    const listadoProyectosRestaurado = await request(app)
      .get('/api/proyectos')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(
      listadoProyectosRestaurado.body.some((p) => p.id === subVista.body.id),
      'reactivar la base debe restaurar la visibilidad de la sub-vista sin haberla tocado nunca',
    );
  });

  it('activo con valor no booleano en actualizar -> 400 (nunca Boolean(valor) de cliente)', async () => {
    const crearBase = await request(app)
      .post('/api/proyectos-base')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Base Para Validar Activo' });

    const resp = await request(app)
      .put(`/api/proyectos-base/${crearBase.body.id}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ activo: 'false' });
    assert.equal(resp.status, 400);
  });
});
