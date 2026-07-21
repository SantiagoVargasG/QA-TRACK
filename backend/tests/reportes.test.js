// Límite pequeño para poder probar el rechazo por tamaño sin subir archivos gigantes; se
// setea ANTES de requerir entorno/app porque utils/evidencias.js lee la env var al cargar
// el módulo (node --test aísla cada archivo en su propio proceso, así que no afecta a otras
// suites).
process.env.MAX_IMAGE_MB = '1';
process.env.MAX_VIDEO_MB = '2';

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('reportes: rechazo, solucionado, cierre, reapertura, evidencias e histórico', () => {
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

  async function crearCriterioFinalizado() {
    const criterioId = await crearCriterio();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    return criterioId;
  }

  async function rechazar(criterioId, token = base.tokens.qa, comentario = 'No cumple con el requisito X') {
    return request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send({ columna: 'QA', accion: 'rechazar', comentario });
  }

  async function crearCriterioRechazado() {
    const criterioId = await crearCriterioFinalizado();
    await rechazar(criterioId);
    return criterioId;
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
    fs.rmSync(path.join(process.env.UPLOADS_PATH, base.tenantId), { recursive: true, force: true });
  });

  it('rechazar sin comentario -> 400; con comentario -> RECHAZADO y crea un reporte con entrada tipo rechazo', async () => {
    const criterioId = await crearCriterioFinalizado();

    const sinComentario = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'rechazar' });
    assert.equal(sinComentario.status, 400);

    const resp = await rechazar(criterioId, base.tokens.qa, 'Falta validar el campo email');
    assert.equal(resp.status, 200);
    assert.equal(resp.body.estado, 'RECHAZADO');
    assert.equal(resp.body.checks.find((c) => c.columnaNombre === 'QA').valor, 'rechazado');

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.status, 200);
    assert.equal(historico.body.length, 1);
    assert.equal(historico.body[0].estadoCaso, 'abierto');
    assert.equal(historico.body[0].entradas.length, 1);
    assert.equal(historico.body[0].entradas[0].tipo, 'rechazo');
    assert.equal(historico.body[0].entradas[0].comentario, 'Falta validar el campo email');
    assert.equal(historico.body[0].entradas[0].porAdmin, false);
  });

  it('rechazar en un estado que no lo permite (PENDIENTE) -> 400', async () => {
    const criterioId = await crearCriterio();
    const resp = await rechazar(criterioId);
    assert.equal(resp.status, 400);
  });

  it('rol equivocado no puede rechazar (Dev), solucionar (QA), cerrar_caso (Dev) ni reabrir (Dev)', async () => {
    const rechazadoPorDev = await (async () => {
      const criterioId = await crearCriterioFinalizado();
      return request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'QA', accion: 'rechazar', comentario: 'x' });
    })();
    assert.equal(rechazadoPorDev.status, 403);

    const criterioRechazado = await crearCriterioRechazado();
    const solucionaQA = await request(app)
      .post(`/api/criterios/${criterioRechazado}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });
    assert.equal(solucionaQA.status, 403);
  });

  it('solucionar sin rechazo previo (estado no es RECHAZADO) -> 400; Dev soluciona un CA rechazado -> SOLUCIONADO', async () => {
    const criterioFinalizado = await crearCriterioFinalizado();
    const solucionarPrematuro = await request(app)
      .post(`/api/criterios/${criterioFinalizado}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });
    assert.equal(solucionarPrematuro.status, 400);

    const criterioId = await crearCriterioRechazado();
    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });
    assert.equal(resp.status, 200);
    assert.equal(resp.body.estado, 'SOLUCIONADO');

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.body[0].estadoCaso, 'solucionado');
    assert.equal(historico.body[0].entradas.length, 2);
    assert.equal(historico.body[0].entradas[1].tipo, 'solucion');
  });

  it('cerrar_caso solo con aprobar_rechazar; tras SOLUCIONADO deja el CA en APROBADO y el reporte en cerrado', async () => {
    const criterioId = await crearCriterioRechazado();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });

    const cerrarSinCapacidad = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'QA', accion: 'cerrar_caso' });
    assert.equal(cerrarSinCapacidad.status, 403);

    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'cerrar_caso' });
    assert.equal(resp.status, 200);
    assert.equal(resp.body.estado, 'APROBADO');

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.body[0].estadoCaso, 'cerrado');
    assert.equal(historico.body[0].entradas.at(-1).tipo, 'cierre');
  });

  it('rechazar de nuevo tras SOLUCIONADO reabre el mismo caso (mismo reporte, nuevo ciclo)', async () => {
    const criterioId = await crearCriterioRechazado();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });

    const resp = await rechazar(criterioId, base.tokens.qa, 'Sigue sin funcionar');
    assert.equal(resp.status, 200);
    assert.equal(resp.body.estado, 'RECHAZADO');

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.body.length, 1, 'debe ser el mismo reporte, no uno nuevo');
    assert.equal(historico.body[0].estadoCaso, 'abierto');
    assert.equal(historico.body[0].entradas.length, 3);
    assert.deepEqual(
      historico.body[0].entradas.map((e) => e.tipo),
      ['rechazo', 'solucion', 'rechazo'],
    );
  });

  it('reabrir un CA aprobado (camino feliz, sin rechazo previo) crea un reporte nuevo con entrada reapertura', async () => {
    const criterioId = await crearCriterioFinalizado();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });

    const reabrirSinCapacidad = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'QA', accion: 'reabrir' });
    assert.equal(reabrirSinCapacidad.status, 403);

    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'reabrir' });
    assert.equal(resp.status, 200);
    assert.equal(resp.body.estado, 'RECHAZADO');

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.body.length, 1);
    assert.equal(historico.body[0].entradas[0].tipo, 'reapertura');
  });

  it('esAdmin puede rechazar sin ser miembro del equipo, y queda marcado porAdmin=true en el reporte', async () => {
    const criterioId = await crearCriterioFinalizado();
    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ columna: 'QA', accion: 'rechazar', comentario: 'Corrección administrativa' });
    assert.equal(resp.status, 200);

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(historico.body[0].entradas[0].porAdmin, true);
  });

  it('evidencias: imagen válida se sube y queda referenciada; MIME no permitido -> 400; tamaño excede el máximo de su tipo -> 400', async () => {
    const criterioId = await crearCriterioFinalizado();

    const conEvidencia = await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .field('columna', 'QA')
      .field('accion', 'rechazar')
      .field('comentario', 'Ver captura adjunta')
      .attach('evidencias', Buffer.from('contenido-de-prueba'), {
        filename: 'captura.png',
        contentType: 'image/png',
      });
    assert.equal(conEvidencia.status, 200);

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const evidencias = historico.body[0].entradas[0].evidencias;
    assert.equal(evidencias.length, 1);
    assert.equal(evidencias[0].tipoMime, 'image/png');

    const criterioMime = await crearCriterioFinalizado();
    const mimeInvalido = await request(app)
      .post(`/api/criterios/${criterioMime}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .field('columna', 'QA')
      .field('accion', 'rechazar')
      .field('comentario', 'x')
      .attach('evidencias', Buffer.from('contenido'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    assert.equal(mimeInvalido.status, 400);

    const criterioTamano = await crearCriterioFinalizado();
    const bufferGrande = Buffer.alloc(1.5 * 1024 * 1024);
    const tamanoExcedido = await request(app)
      .post(`/api/criterios/${criterioTamano}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .field('columna', 'QA')
      .field('accion', 'rechazar')
      .field('comentario', 'x')
      .attach('evidencias', bufferGrande, { filename: 'grande.png', contentType: 'image/png' });
    assert.equal(tamanoExcedido.status, 400);
  });

  it('GET /uploads/:archivo sirve el archivo al mismo tenant; nombre inválido -> 400; cross-tenant -> 404; sin token -> 401', async () => {
    const criterioId = await crearCriterioFinalizado();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .field('columna', 'QA')
      .field('accion', 'rechazar')
      .field('comentario', 'Ver captura')
      .attach('evidencias', Buffer.from('contenido-de-prueba'), {
        filename: 'captura2.png',
        contentType: 'image/png',
      });

    const historico = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const archivo = historico.body[0].entradas[0].evidencias[0].archivo;

    const sirve = await request(app)
      .get(`/api/uploads/${archivo}`)
      .set('Authorization', `Bearer ${base.tokens.qa}`);
    assert.equal(sirve.status, 200);

    // Un :archivo de un solo segmento (Express ni siquiera matchea rutas con "/" en el
    // parámetro, así que un intento de path traversal con "/" cae directo en 404 de rutas)
    // pero con formato inválido (sin extensión) debe rechazarse explícitamente con 400.
    const nombreInvalido = await request(app)
      .get('/api/uploads/sin-extension')
      .set('Authorization', `Bearer ${base.tokens.qa}`);
    assert.equal(nombreInvalido.status, 400);

    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Reportes B', email: 'admin@reportesb.com' });
    const cruzado = await request(app)
      .get(`/api/uploads/${archivo}`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(cruzado.status, 404);

    const sinToken = await request(app).get(`/api/uploads/${archivo}`);
    assert.equal(sinToken.status, 401);
  });

  it('GET /criterios/:id/reportes: histórico consultable con el CA ya APROBADO; cross-tenant -> 404; sin token -> 401', async () => {
    const criterioId = await crearCriterioRechazado();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'solucionar' });
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'cerrar_caso' });

    const resp = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.lector}`);
    assert.equal(resp.status, 200);
    assert.equal(resp.body.length, 1);
    assert.equal(resp.body[0].estadoCaso, 'cerrado');

    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Reportes C', email: 'admin@reportesc.com' });
    const cruzado = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(cruzado.status, 404);

    const sinToken = await request(app).get(`/api/criterios/${criterioId}/reportes`);
    assert.equal(sinToken.status, 401);
  });

  it('id malformado en :id de reportes -> 400', async () => {
    const resp = await request(app)
      .get('/api/criterios/no-es-un-objectid/reportes')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(resp.status, 400);
  });
});
