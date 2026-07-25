const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');
const Rol = require('../src/models/Rol');

describe('criterios: CRUD, máquina de estados (camino feliz) y permisos por columna/rol', () => {
  let app;
  let base;
  let proyectoId;
  let historiaId;

  async function crearCriterio(texto = 'Criterio de prueba') {
    const resp = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto });
    return resp.body.id;
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

  it('crear criterio requiere gestionar_contenido; queda en PENDIENTE sin checks', async () => {
    const sinCapacidad = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 'X' });
    assert.equal(sinCapacidad.status, 403);

    const resp = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'El total recalcula al eliminar un ítem' });
    assert.equal(resp.status, 201);
    assert.equal(resp.body.estado, 'PENDIENTE');
    assert.deepEqual(resp.body.checks, []);
  });

  it('texto requerido, tipo string y longitud máxima de 500 caracteres', async () => {
    const sinTexto = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({});
    assert.equal(sinTexto.status, 400);

    const noString = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 12345 });
    assert.equal(noString.status, 400);

    const muyLargo = await request(app)
      .post(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'a'.repeat(501) });
    assert.equal(muyLargo.status, 400);
  });

  it('camino feliz: PENDIENTE -> FINALIZADO_DEV (Dev) -> APROBADO (QA), sin pasos intermedios', async () => {
    const criterioId = await crearCriterio();

    const aprobarPrematuro = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(aprobarPrematuro.status, 400, 'no se puede aprobar sin pasar antes por FINALIZADO_DEV');

    const finalizar = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(finalizar.status, 200);
    assert.equal(finalizar.body.estado, 'FINALIZADO_DEV');
    assert.equal(finalizar.body.checks[0].columnaNombre, 'Desarrollo');
    assert.equal(finalizar.body.checks[0].usuarioId, base.usuarios.dev.id);

    const aprobar = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(aprobar.status, 200);
    assert.equal(aprobar.body.estado, 'APROBADO');

    const trasAprobado = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(
      trasAprobado.status,
      400,
      'aprobar a la primera no debe habilitar ninguna acción de "solucionado" ni volver a aprobar',
    );
  });

  it('un rol asignado a la columna QA no puede tocar la columna Desarrollo, y viceversa (403)', async () => {
    const criterioId = await crearCriterio();

    const qaTocaDesarrollo = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(qaTocaDesarrollo.status, 403);

    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });

    const devTocaQA = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(devTocaQA.status, 403);
  });

  it('rol asignado a la columna pero SIN la capacidad requerida -> 403 "Requiere la capacidad...", no "sin rol asignado"', async () => {
    // A diferencia del test anterior (QA tocando Desarrollo: falla por rol-no-asignado), acá
    // el rol SÍ es el asignado a la columna QA — se le quita la capacidad para llegar al otro
    // branch de aplicarCheck(). Se restaura el rol semilla al final para no afectar el resto
    // de los tests de este archivo (todos comparten la misma base/equipo).
    const rolQA = await Rol.findById(base.roles.qa._id);
    const capacidadesOriginales = [...rolQA.capacidades];
    rolQA.capacidades = rolQA.capacidades.filter((c) => c !== 'aprobar_rechazar');
    await rolQA.save();

    try {
      const criterioId = await crearCriterio();
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'finalizar' });

      const resp = await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });
      assert.equal(resp.status, 403);
      assert.equal(resp.body.error, 'Requiere la capacidad "aprobar_rechazar" en este proyecto');
    } finally {
      rolQA.capacidades = capacidadesOriginales;
      await rolQA.save();
    }
  });

  it('lector (sin marcar_finalizado ni aprobar_rechazar) no puede accionar ninguna columna', async () => {
    // El rol Lector no está asignado a ninguna columna del proyecto (solo Dev/QA lo están),
    // así que ya falla por rol-no-asignado antes de llegar a la verificación de capacidad.
    const criterioId = await crearCriterio();
    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.lector}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(resp.status, 403);
  });

  it('acción que no corresponde al tipo de la columna -> 400', async () => {
    const criterioId = await crearCriterio();
    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'aprobar' });
    assert.equal(resp.status, 400);
  });

  it('columna inexistente en el proyecto -> 400; columna no-string -> 400', async () => {
    const criterioId = await crearCriterio();
    const inexistente = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'NoExiste', accion: 'finalizar' });
    assert.equal(inexistente.status, 400);

    const noString = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: { $ne: null }, accion: 'finalizar' });
    assert.equal(noString.status, 400);
  });

  it('esAdmin puede finalizar Y aprobar cualquier columna sin ser miembro del equipo', async () => {
    const criterioId = await crearCriterio();
    const finalizar = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(finalizar.status, 200);

    const aprobar = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(aprobar.status, 200);
    assert.equal(aprobar.body.estado, 'APROBADO');
  });

  it('cross-tenant: admin de otro tenant recibe 404 en listar, editar, eliminar y check', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Crit B', email: 'admin@critb.com' });
    const tokenB = regB.body.token;
    const criterioId = await crearCriterio();

    const listar = await request(app)
      .get(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(listar.status, 404);

    const editar = await request(app)
      .put(`/api/historias/${historiaId}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ texto: 'Hackeado' });
    assert.equal(editar.status, 404);

    const eliminar = await request(app)
      .delete(`/api/historias/${historiaId}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(eliminar.status, 404);

    const check = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(check.status, 404);
  });

  it('sin token -> 401 en listar y en check', async () => {
    const criterioId = await crearCriterio();
    const listar = await request(app).get(`/api/historias/${historiaId}/criterios`);
    assert.equal(listar.status, 401);

    const check = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(check.status, 401);
  });

  it('id malformado -> 400 en :historiaId, :criterioId y en el :id de check', async () => {
    const malformadoHistoria = await request(app)
      .get('/api/historias/no-es-un-objectid/criterios')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(malformadoHistoria.status, 400);

    const malformadoCheck = await request(app)
      .post('/api/criterios/no-es-un-objectid/check')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    assert.equal(malformadoCheck.status, 400);
  });

  it('actualizar/eliminar con rol sin gestionar_contenido -> 403; un criterio real con historiaId ajeno en la URL -> 404', async () => {
    const criterioId = await crearCriterio();

    const put = await request(app)
      .put(`/api/historias/${historiaId}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 'Hackeado' });
    assert.equal(put.status, 403);

    const del = await request(app)
      .delete(`/api/historias/${historiaId}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(del.status, 403);

    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Otro módulo' });
    const otroReq = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Otro req', descripcionResumida: 'desc' });
    const otraHistoria = await request(app)
      .post(`/api/requerimientos/${otroReq.body.id}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Otra historia' });

    const mismatch = await request(app)
      .put(`/api/historias/${otraHistoria.body.id}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'Hackeado' });
    assert.equal(mismatch.status, 404);
  });

  it('dos "finalizar" concurrentes (doble clic) sobre el mismo criterio PENDIENTE: solo uno transiciona, el otro recibe 400', async () => {
    const criterioId = await crearCriterio();

    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'finalizar' }),
      request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'finalizar' }),
    ]);

    const estados = [a.status, b.status].sort();
    assert.deepEqual(
      estados,
      [200, 400],
      `exactamente una de las dos requests concurrentes debe transicionar (200) y la otra debe rechazarse (400) — obtuve ${estados}`,
    );
  });

  it('accionesPermitidas en el listado refleja el rol/capacidad del usuario, sin reemplazar la validación real de check', async () => {
    const criterioId = await crearCriterio();

    async function listarComo(token) {
      const resp = await request(app)
        .get(`/api/historias/${historiaId}/criterios`)
        .set('Authorization', `Bearer ${token}`);
      return resp.body.find((c) => c.id === criterioId);
    }

    // PENDIENTE: solo Dev (o admin) tiene algo para hacer, vía la columna Desarrollo. QA y
    // Lector no tienen ninguna acción disponible en este estado.
    assert.deepEqual((await listarComo(base.tokens.dev)).accionesPermitidas, [
      { accion: 'finalizar', columna: 'Desarrollo' },
    ]);
    assert.deepEqual((await listarComo(base.tokens.qa)).accionesPermitidas, []);
    assert.deepEqual((await listarComo(base.tokens.lector)).accionesPermitidas, []);
    assert.deepEqual((await listarComo(base.tokens.admin)).accionesPermitidas, [
      { accion: 'finalizar', columna: 'Desarrollo' },
    ]);

    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });

    // FINALIZADO_DEV: ahora es QA quien tiene acciones (aprobar/rechazar vía QA); Dev ya no
    // tiene nada que hacer sobre este criterio en este estado.
    assert.deepEqual((await listarComo(base.tokens.dev)).accionesPermitidas, []);
    assert.deepEqual((await listarComo(base.tokens.qa)).accionesPermitidas, [
      { accion: 'aprobar', columna: 'QA' },
      { accion: 'rechazar', columna: 'QA' },
    ]);

    // El campo es solo un hint de presentación: si QA ejecuta la acción que el hint marcó
    // como disponible, el backend la valida igual en aplicarCheck() y la acepta — no es un
    // atajo que se salte esa validación, es un espejo correcto de la misma regla.
    const aprobar = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    assert.equal(aprobar.status, 200);
    assert.equal(aprobar.body.estado, 'APROBADO');
  });

  it('soft-delete: el criterio eliminado desaparece del listado', async () => {
    const criterioId = await crearCriterio('Para borrar');
    await request(app)
      .delete(`/api/historias/${historiaId}/criterios/${criterioId}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);

    const lista = await request(app)
      .get(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.ok(!lista.body.some((c) => c.id === criterioId));
  });
});
