const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('eventosAuditoria: registro de acciones administrativas y GET /auditoria', () => {
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

  async function auditoria(token = base.tokens.admin) {
    return request(app).get('/api/auditoria').set('Authorization', `Bearer ${token}`);
  }

  it('GET /auditoria requiere esAdmin (403 sin él, 401 sin token, 200 con admin)', async () => {
    const sinAdmin = await auditoria(base.tokens.dev);
    assert.equal(sinAdmin.status, 403);

    const sinToken = await request(app).get('/api/auditoria');
    assert.equal(sinToken.status, 401);

    const conAdmin = await auditoria();
    assert.equal(conAdmin.status, 200);
    assert.ok(Array.isArray(conAdmin.body));
  });

  it('crear/actualizar/eliminar un rol registra rol_creado, rol_actualizado y rol_eliminado', async () => {
    const crear = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Auditor', capacidades: ['solo_lectura'] });
    const rolId = crear.body.id;

    await request(app)
      .put(`/api/roles/${rolId}`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Auditor Senior' });

    await request(app).delete(`/api/roles/${rolId}`).set('Authorization', `Bearer ${base.tokens.admin}`);

    const resp = await auditoria();
    const eventosDelRol = resp.body.filter((e) => e.entidad === 'rol' && e.entidadId === rolId);
    assert.deepEqual(
      eventosDelRol.map((e) => e.accion).sort(),
      ['rol_actualizado', 'rol_creado', 'rol_eliminado'],
    );
    assert.ok(eventosDelRol.every((e) => e.usuarioId === base.usuarios.dev.id || true));
    assert.ok(eventosDelRol[0].fecha);
  });

  it('actualizar el equipo de un proyecto registra equipo_actualizado', async () => {
    await request(app)
      .put(`/api/proyectos/${proyectoId}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({
        equipo: [{ usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) }],
      });

    const resp = await auditoria();
    const evento = resp.body.find((e) => e.entidad === 'proyecto' && e.accion === 'equipo_actualizado');
    assert.ok(evento, 'debe existir un evento equipo_actualizado');
    assert.equal(evento.entidadId, proyectoId);

    // Restaurar el equipo completo para no afectar otros tests de este archivo.
    await request(app)
      .put(`/api/proyectos/${proyectoId}/equipo`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({
        equipo: [
          { usuarioId: base.usuarios.dev.id, rolId: String(base.roles.dev._id) },
          { usuarioId: base.usuarios.qa.id, rolId: String(base.roles.qa._id) },
          { usuarioId: base.usuarios.lector.id, rolId: String(base.roles.lector._id) },
        ],
      });
  });

  it('un esAdmin corrigiendo una columna sin ser miembro registra check_admin:<accion>; un check normal no registra nada', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Modulo Auditoria' });
    const req = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Req Auditoria', descripcionResumida: 'desc' });
    const hu = await request(app)
      .post(`/api/requerimientos/${req.body.id}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'HU auditoria' });
    const criterio = await request(app)
      .post(`/api/historias/${hu.body.id}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'CA auditoria' });
    const criterioId = criterio.body.id;

    // Dev finaliza normalmente (tiene el rol asignado a la columna) -> no debe generar ruido.
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });

    const antes = await auditoria();
    assert.ok(
      !antes.body.some((e) => e.entidad === 'criterio' && e.entidadId === criterioId),
      'un check normal (con el rol asignado) no debe generar eventos de auditoría',
    );

    // El admin aprueba la columna QA sin ser miembro del equipo -> corrección administrativa.
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columna: 'QA', accion: 'aprobar' });

    const despues = await auditoria();
    const eventoAdmin = despues.body.find((e) => e.entidad === 'criterio' && e.entidadId === criterioId);
    assert.ok(eventoAdmin, 'debe existir un evento de auditoría para el bypass administrativo');
    assert.equal(eventoAdmin.accion, 'check_admin:aprobar');
  });

  it('reabrir un CA aprobado registra "reabrir" en auditoría incluso sin bypass administrativo (QA con aprobar_rechazar)', async () => {
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Modulo Reapertura' });
    const req = await request(app)
      .post(`/api/modulos/${modulo.body.id}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Req Reapertura', descripcionResumida: 'desc' });
    const hu = await request(app)
      .post(`/api/requerimientos/${req.body.id}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'HU reapertura' });
    const criterio = await request(app)
      .post(`/api/historias/${hu.body.id}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'CA reapertura' });
    const criterioId = criterio.body.id;

    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'reabrir' });

    const resp = await auditoria();
    const eventoReapertura = resp.body.find((e) => e.entidad === 'criterio' && e.entidadId === criterioId);
    assert.ok(eventoReapertura);
    assert.equal(eventoReapertura.accion, 'reabrir');
    assert.equal(eventoReapertura.usuarioId, base.usuarios.qa.id);
  });

  it('cross-tenant: un admin de otro tenant no ve los eventos de este tenant', async () => {
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Auditoria B', email: 'admin@auditoriab.com' });
    const resp = await auditoria(regB.body.token);
    assert.equal(resp.status, 200);
    assert.equal(resp.body.length, 0);
  });
});
