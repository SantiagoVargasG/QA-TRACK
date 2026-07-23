const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('dashboard: resumen agregado de Inicio y miembros de proyecto', () => {
  let app;
  let base;
  let proyectoId;
  let historiaId;

  async function crearCriterio(texto) {
    const resp = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto });
    return resp.body.id;
  }

  async function check(criterioId, columna, accion, extra = {}) {
    return request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${accion === 'finalizar' || accion === 'solucionar' ? base.tokens.dev : base.tokens.qa}`)
      .send({ columna, accion, ...extra });
  }

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    ({ proyectoId } = await crearProyectoConEquipo(app, base));
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Catálogo' });
    const req = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Crear producto', descripcionResumida: 'desc' });
    const historia = await request(app)
      .post(`/api/requerimientos/${req.body.id}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Como admin quiero crear un producto' });
    historiaId = historia.body.id;
  });

  after(async () => {
    await entorno.detener();
  });

  it('GET /dashboard requiere autenticación', async () => {
    const resp = await request(app).get('/api/dashboard');
    assert.equal(resp.status, 401);
  });

  it('cuenta criterios por estado y % aprobado a la primera, escopado al proyecto del equipo', async () => {
    // Pendiente de QA: se queda en FINALIZADO_DEV.
    const pendiente = await crearCriterio('Pendiente de QA');
    await check(pendiente, 'Desarrollo', 'finalizar');

    // Aprobado a la primera: camino feliz sin rechazo.
    const primeraVez = await crearCriterio('Aprobado a la primera');
    await check(primeraVez, 'Desarrollo', 'finalizar');
    await check(primeraVez, 'QA', 'aprobar');

    // Rechazado abierto: se queda en RECHAZADO.
    const rechazado = await crearCriterio('Rechazado abierto');
    await check(rechazado, 'Desarrollo', 'finalizar');
    await check(rechazado, 'QA', 'rechazar', { comentario: 'No cumple' });

    // Aprobado tras un ciclo de rechazo: NO cuenta como "a la primera".
    const conCiclo = await crearCriterio('Aprobado tras ciclo');
    await check(conCiclo, 'Desarrollo', 'finalizar');
    await check(conCiclo, 'QA', 'rechazar', { comentario: 'Corregir' });
    await check(conCiclo, 'Desarrollo', 'solucionar');
    await check(conCiclo, 'QA', 'cerrar_caso');

    const resp = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(resp.status, 200);
    assert.equal(resp.body.criteriosPendientesQA, 1);
    assert.equal(resp.body.criteriosRechazadosAbiertos, 1);
    // 2 aprobados en total (primeraVez + conCiclo), 1 de ellos a la primera => 50%.
    assert.equal(resp.body.porcentajeAprobadoPrimeraVez, 50);

    const proyecto = resp.body.proyectos.find((p) => p.id === proyectoId);
    assert.ok(proyecto, 'el proyecto del equipo aparece en el resumen');
    assert.equal(proyecto.totalHistorias, 1);
    assert.equal(proyecto.criteriosTotal, 4);
    assert.equal(proyecto.criteriosAprobados, 2);
    assert.equal(proyecto.progresoAprobados, 50);
    assert.equal(proyecto.totalIntegrantes, 3);
  });

  it('un usuario sin proyectos ve totales en cero, sin ver proyectos ajenos (aislamiento)', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Dashboard B', email: 'admin@dashb.com' });
    const resp = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(resp.status, 200);
    assert.equal(resp.body.totalProyectos, 0);
    assert.deepEqual(resp.body.proyectos, []);
    assert.equal(resp.body.criteriosPendientesQA, 0);
    assert.equal(resp.body.porcentajeAprobadoPrimeraVez, null);
  });

  it('un miembro del equipo ve el proyecto en su resumen; un forastero no', async () => {
    const comoDev = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.ok(comoDev.body.proyectos.some((p) => p.id === proyectoId));

    const comoForastero = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.equal(comoForastero.body.totalProyectos, 0);
  });

  it('GET /proyectos/:id/miembros devuelve solo id+nombre de los miembros del equipo', async () => {
    const resp = await request(app)
      .get(`/api/proyectos/${proyectoId}/miembros`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(resp.status, 200);
    assert.equal(resp.body.length, 3);
    const nombres = resp.body.map((m) => m.nombre).sort();
    assert.deepEqual(nombres, ['Dev User', 'Lector User', 'QA User']);
    assert.ok(!('email' in resp.body[0]), 'no expone email');
    assert.ok(!('esAdmin' in resp.body[0]), 'no expone esAdmin');
  });

  it('un forastero (ni admin) recibe 404 en miembros; cross-tenant también 404', async () => {
    const forastero = await request(app)
      .get(`/api/proyectos/${proyectoId}/miembros`)
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.equal(forastero.status, 404);

    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Miembros B', email: 'admin@miembrosb.com' });
    const crossTenant = await request(app)
      .get(`/api/proyectos/${proyectoId}/miembros`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(crossTenant.status, 404);
  });
});
