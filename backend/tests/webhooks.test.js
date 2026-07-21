// Reintentos y timeout acortados para que los tests de disparo/reintentos no tarden los
// 10s/5s/15s reales del PRD — ver webhookDisparo.service.js, que lee estos valores al
// cargar el módulo (node --test aísla cada archivo en su propio proceso).
process.env.WEBHOOK_TIMEOUT_MS = '500';
process.env.WEBHOOK_REINTENTOS_MS = '50,80';

const http = require('http');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

function crearServidorMock() {
  const requests = [];
  let comportamiento = () => 200;
  const server = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (chunk) => {
      cuerpo += chunk;
    });
    req.on('end', () => {
      let body = null;
      try {
        body = cuerpo ? JSON.parse(cuerpo) : null;
      } catch {
        body = cuerpo;
      }
      requests.push({ body });
      const status = comportamiento(requests.length);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });

  return {
    requests,
    setComportamiento(fn) {
      comportamiento = fn;
    },
    iniciar() {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/webhook`));
      });
    },
    detener() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

async function esperarHasta(condicion, { timeoutMs = 3000, intervalMs = 25 } = {}) {
  const inicio = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (condicion()) return true;
    if (Date.now() - inicio >= timeoutMs) return condicion();
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('webhooks: CRUD, disparo por evento, reintentos y reportar-prueba', () => {
  let app;
  let base;
  let proyectoId;
  let moduloId;
  let requerimientoId;
  let mock;
  let mockUrl;

  before(async () => {
    app = await entorno.iniciar();
    base = await crearTenantConEquipoBase(app);
    ({ proyectoId } = await crearProyectoConEquipo(app, base));
    const modulo = await request(app)
      .post(`/api/proyectos/${proyectoId}/modulos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ nombre: 'Catálogo' });
    moduloId = modulo.body.id;
    const req = await request(app)
      .post(`/api/modulos/${moduloId}/requerimientos`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ titulo: 'Crear producto', descripcionResumida: 'desc' });
    requerimientoId = req.body.id;

    mock = crearServidorMock();
    mockUrl = await mock.iniciar();
  });

  after(async () => {
    await mock.detener();
    await entorno.detener();
  });

  beforeEach(async () => {
    mock.requests.length = 0;
    mock.setComportamiento(() => 200);
    // Los webhooks se acumularían entre tests (cada uno crea el suyo) y contaminarían el
    // conteo de requests recibidas por el mock — se limpian antes de cada test.
    await mongoose.model('Webhook').deleteMany({ tenantId: base.tenantId });
  });

  async function crearWebhook(overrides = {}) {
    const resp = await request(app)
      .post(`/api/proyectos/${proyectoId}/webhooks`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({
        nombre: 'Webhook de prueba',
        url: mockUrl,
        proveedor: 'generico',
        eventos: ['criterio_rechazado'],
        ...overrides,
      });
    return resp;
  }

  async function crearHistoriaConCriterio(texto = 'Como QA quiero verificar') {
    const historia = await request(app)
      .post(`/api/requerimientos/${requerimientoId}/historias`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto });
    const criterio = await request(app)
      .post(`/api/historias/${historia.body.id}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`)
      .send({ texto: 'El sistema debe hacer algo' });
    return { historiaId: historia.body.id, criterioId: criterio.body.id };
  }

  async function finalizar(criterioId, token = base.tokens.dev) {
    return request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
  }

  async function rechazar(criterioId, comentario = 'No cumple', token = base.tokens.qa) {
    return request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send({ columna: 'QA', accion: 'rechazar', comentario });
  }

  describe('CRUD', () => {
    it('crear requiere esAdmin (403 sin él, 401 sin token, 201 con admin)', async () => {
      const sinAdmin = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: ['criterio_aprobado'] });
      assert.equal(sinAdmin.status, 403);

      const sinToken = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: ['criterio_aprobado'] });
      assert.equal(sinToken.status, 401);

      const resp = await crearWebhook();
      assert.equal(resp.status, 201);
      assert.equal(resp.body.nombre, 'Webhook de prueba');
      assert.equal(resp.body.activo, true);
    });

    it('valida nombre, url (formato y protocolo), proveedor y eventos', async () => {
      const sinNombre = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ url: mockUrl, proveedor: 'generico', eventos: ['criterio_aprobado'] });
      assert.equal(sinNombre.status, 400);

      const urlInvalida = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: 'no-es-una-url', proveedor: 'generico', eventos: ['criterio_aprobado'] });
      assert.equal(urlInvalida.status, 400);

      const protocoloInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: 'ftp://ejemplo.com', proveedor: 'generico', eventos: ['criterio_aprobado'] });
      assert.equal(protocoloInvalido.status, 400);

      const proveedorInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'slack', eventos: ['criterio_aprobado'] });
      assert.equal(proveedorInvalido.status, 400);

      const sinEventos = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: [] });
      assert.equal(sinEventos.status, 400);

      const eventoInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: ['evento_inventado'] });
      assert.equal(eventoInvalido.status, 400);
    });

    it('listar/actualizar/eliminar: cross-tenant -> 404, id malformado -> 400, actualización parcial', async () => {
      const creado = await crearWebhook();
      const webhookId = creado.body.id;

      const regB = await registrarTenant(app, { nombreTenant: 'Tenant Webhooks B', email: 'admin@webhooksb.com' });
      const listarCruzado = await request(app)
        .get(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${regB.body.token}`);
      assert.equal(listarCruzado.status, 404);

      const actualizarCruzado = await request(app)
        .put(`/api/proyectos/${proyectoId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${regB.body.token}`)
        .send({ nombre: 'Hackeado' });
      assert.equal(actualizarCruzado.status, 404);

      const idMalformado = await request(app)
        .put(`/api/proyectos/${proyectoId}/webhooks/no-es-un-objectid`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'x' });
      assert.equal(idMalformado.status, 400);

      const actualizado = await request(app)
        .put(`/api/proyectos/${proyectoId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ activo: false });
      assert.equal(actualizado.status, 200);
      assert.equal(actualizado.body.activo, false);
      assert.equal(actualizado.body.nombre, 'Webhook de prueba', 'una actualización parcial no debe tocar otros campos');

      const eliminarCruzado = await request(app)
        .delete(`/api/proyectos/${proyectoId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${regB.body.token}`);
      assert.equal(eliminarCruzado.status, 404);

      const eliminado = await request(app)
        .delete(`/api/proyectos/${proyectoId}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${base.tokens.admin}`);
      assert.equal(eliminado.status, 200);

      const listaFinal = await request(app)
        .get(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`);
      assert.ok(!listaFinal.body.some((w) => w.id === webhookId));
    });
  });

  describe('disparo de eventos', () => {
    it('rechazar un criterio dispara "criterio_rechazado" al webhook suscrito (proveedor genérico)', async () => {
      await crearWebhook({ eventos: ['criterio_rechazado'] });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);

      const resp = await rechazar(criterioId, 'Falta validar el email');
      assert.equal(resp.status, 200);

      await esperarHasta(() => mock.requests.length >= 1);
      assert.equal(mock.requests.length, 1);
      const payload = mock.requests[0].body;
      assert.equal(payload.evento, 'criterio_rechazado');
      assert.equal(payload.proyecto, 'Proyecto Demo');
      assert.equal(payload.modulo, 'Catálogo');
      assert.match(payload.historia, /Como QA quiero verificar/);
      assert.equal(payload.comentario, 'Falta validar el email');
      assert.ok(payload.autor);
      assert.ok(payload.fecha);
    });

    it('un webhook con proveedor google_chat recibe un cardsV2 en vez del payload plano', async () => {
      await crearWebhook({ eventos: ['criterio_rechazado'], proveedor: 'google_chat' });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await rechazar(criterioId, 'Ver formato Google Chat');

      await esperarHasta(() => mock.requests.length >= 1);
      const payload = mock.requests[0].body;
      assert.ok(Array.isArray(payload.cardsV2));
      assert.ok(payload.cardsV2[0].card.header.title);
    });

    it('un webhook desactivado no recibe notificaciones', async () => {
      await crearWebhook({ eventos: ['criterio_rechazado'], activo: false });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await rechazar(criterioId);

      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(mock.requests.length, 0);
    });

    it('un webhook no suscrito al evento disparado no recibe notificaciones', async () => {
      await crearWebhook({ eventos: ['caso_cerrado'] });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await rechazar(criterioId);

      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(mock.requests.length, 0);
    });

    it('aprobar (camino feliz) dispara "criterio_aprobado"; reabrir un CA aprobado dispara "criterio_rechazado"', async () => {
      await crearWebhook({ eventos: ['criterio_aprobado', 'criterio_rechazado'] });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      await esperarHasta(() => mock.requests.length >= 1);
      assert.equal(mock.requests[0].body.evento, 'criterio_aprobado');

      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'reabrir' });

      await esperarHasta(() => mock.requests.length >= 2);
      assert.equal(mock.requests[1].body.evento, 'criterio_rechazado');
    });

    it('reintenta ante fallas transitorias y termina entregando (2 fallos + 1 éxito = 3 intentos)', async () => {
      await crearWebhook({ eventos: ['criterio_rechazado'] });
      mock.setComportamiento((n) => (n < 3 ? 500 : 200));
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await rechazar(criterioId, 'Reintento');

      await esperarHasta(() => mock.requests.length >= 3, { timeoutMs: 3000 });
      assert.equal(mock.requests.length, 3, 'debe haber reintentado hasta entregar en el 3er intento');
    });
  });

  describe('reportar-prueba', () => {
    it('requiere capacidad aprobar_rechazar (403 para Dev, 200 para QA)', async () => {
      const { historiaId } = await crearHistoriaConCriterio('HU para reportar');

      const sinCapacidad = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ moduloId, historiaIds: [historiaId], resultado: 'exitosa' });
      assert.equal(sinCapacidad.status, 403);

      const conCapacidad = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId, historiaIds: [historiaId], resultado: 'exitosa' });
      assert.equal(conCapacidad.status, 200);
    });

    it('valida moduloId, historiaIds y resultado', async () => {
      const { historiaId } = await crearHistoriaConCriterio('HU validación');

      const moduloInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId: '507f1f77bcf86cd799439011', historiaIds: [historiaId], resultado: 'exitosa' });
      assert.equal(moduloInvalido.status, 400);

      const sinHistorias = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId, historiaIds: [], resultado: 'exitosa' });
      assert.equal(sinHistorias.status, 400);

      const resultadoInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId, historiaIds: [historiaId], resultado: 'mas_o_menos' });
      assert.equal(resultadoInvalido.status, 400);

      const otroModulo = await request(app)
        .post(`/api/proyectos/${proyectoId}/modulos`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'Otro módulo' });
      const historiaDeOtroModulo = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId: otroModulo.body.id, historiaIds: [historiaId], resultado: 'exitosa' });
      assert.equal(historiaDeOtroModulo.status, 400);
    });

    it('arma el resumen con los CA rechazados (comentario más reciente) y dispara prueba_reportada', async () => {
      await crearWebhook({ eventos: ['prueba_reportada'] });

      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU con rechazo');
      await finalizar(criterioId);
      await rechazar(criterioId, 'Primer comentario');
      // Un segundo rechazo directo no es válido (el criterio queda en RECHAZADO, que no es
      // origen válido de "rechazar") — hay que solucionar primero para reabrir el ciclo.
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'solucionar' });
      await rechazar(criterioId, 'Segundo comentario (más reciente)', base.tokens.qa);

      const { historiaId: historiaIdOk } = await crearHistoriaConCriterio('HU sin problemas');

      const resp = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({
          moduloId,
          historiaIds: [historiaId, historiaIdOk],
          resultado: 'con_errores',
          comentario: 'Probado en staging',
        });
      assert.equal(resp.status, 200);
      assert.equal(resp.body.evento, 'prueba_reportada');
      assert.equal(resp.body.resultado, 'con_errores');
      assert.equal(resp.body.historias.length, 2);
      assert.equal(resp.body.criterios_rechazados.length, 1);
      assert.equal(resp.body.criterios_rechazados[0].comentario, 'Segundo comentario (más reciente)');
      assert.equal(resp.body.webhooksNotificados, 1);

      await esperarHasta(() => mock.requests.length >= 1);
      assert.equal(mock.requests[0].body.evento, 'prueba_reportada');
      assert.deepEqual(mock.requests[0].body.criterios_rechazados, resp.body.criterios_rechazados);
    });

    it('sin token -> 401; id de proyecto malformado -> 400', async () => {
      const sinToken = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .send({ moduloId, historiaIds: ['507f1f77bcf86cd799439011'], resultado: 'exitosa' });
      assert.equal(sinToken.status, 401);

      const idMalformado = await request(app)
        .post('/api/proyectos/no-es-un-objectid/reportar-prueba')
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ moduloId, historiaIds: ['507f1f77bcf86cd799439011'], resultado: 'exitosa' });
      assert.equal(idMalformado.status, 400);
    });
  });
});
