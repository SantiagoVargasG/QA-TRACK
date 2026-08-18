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

// IP pública real (Google Public DNS) usada como "url válida" en los tests que solo
// ejercitan el CRUD/la validación, no la entrega real — pasa el guard de SSRF sin depender
// de resolución DNS de un hostname (dns.lookup de un literal de IP no hace red) y sin
// necesitar que el test realmente la alcance (esos tests nunca disparan una entrega).
const URL_PUBLICA_VALIDA = 'http://8.8.8.8/webhook';

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
        url: URL_PUBLICA_VALIDA,
        proveedor: 'generico',
        eventos: ['hu_reportada'],
        ...overrides,
      });
    return resp;
  }

  // El guard de SSRF (Iteración 6) rechaza cualquier URL que resuelva a loopback/privada —
  // incluida 127.0.0.1, que es justamente donde escucha el servidor mock de este archivo. Los
  // tests de disparo/entrega real necesitan que el webhook apunte de verdad al mock, así que
  // insertan el documento directo por el modelo, bypaseando la validación de creación — están
  // probando el MECANISMO de entrega (enviarConReintentos), no el endpoint de creación (que ya
  // se prueba por separado, con URLs que si pasan la validación).
  async function crearWebhookDirecto(overrides = {}) {
    return mongoose.model('Webhook').create({
      tenantId: base.tenantId,
      proyectoId,
      nombre: 'Webhook de prueba (directo)',
      url: mockUrl,
      proveedor: 'generico',
      eventos: ['hu_reportada'],
      activo: true,
      ...overrides,
    });
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
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: ['hu_reportada'] });
      assert.equal(sinAdmin.status, 403);

      const sinToken = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .send({ nombre: 'X', url: mockUrl, proveedor: 'generico', eventos: ['hu_reportada'] });
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
        .send({ url: mockUrl, proveedor: 'generico', eventos: ['hu_reportada'] });
      assert.equal(sinNombre.status, 400);

      const urlInvalida = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: 'no-es-una-url', proveedor: 'generico', eventos: ['hu_reportada'] });
      assert.equal(urlInvalida.status, 400);

      const protocoloInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: 'ftp://ejemplo.com', proveedor: 'generico', eventos: ['hu_reportada'] });
      assert.equal(protocoloInvalido.status, 400);

      const proveedorInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: URL_PUBLICA_VALIDA, proveedor: 'slack', eventos: ['hu_reportada'] });
      assert.equal(proveedorInvalido.status, 400);

      const sinEventos = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: URL_PUBLICA_VALIDA, proveedor: 'generico', eventos: [] });
      assert.equal(sinEventos.status, 400);

      const eventoInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'X', url: URL_PUBLICA_VALIDA, proveedor: 'generico', eventos: ['evento_inventado'] });
      assert.equal(eventoInvalido.status, 400);
    });

    it('url bloquea SSRF: loopback, privados y link-local/metadata de nube; una IP pública sigue pasando', async () => {
      const casosBloqueados = [
        ['loopback IPv4', 'http://127.0.0.1/x'],
        ['loopback IPv6', 'http://[::1]/x'],
        ['privado 10.0.0.0/8', 'http://10.0.0.5/x'],
        ['privado 172.16.0.0/12', 'http://172.16.5.5/x'],
        ['privado 192.168.0.0/16', 'http://192.168.1.1/x'],
        ['link-local / metadata de nube', 'http://169.254.169.254/x'],
        ['localhost literal', 'http://localhost/x'],
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const [nombreCaso, url] of casosBloqueados) {
        // eslint-disable-next-line no-await-in-loop
        const resp = await request(app)
          .post(`/api/proyectos/${proyectoId}/webhooks`)
          .set('Authorization', `Bearer ${base.tokens.admin}`)
          .send({ nombre: 'Bloqueado', url, proveedor: 'generico', eventos: ['hu_reportada'] });
        assert.equal(resp.status, 400, `${nombreCaso} (${url}) debería rechazarse con 400, obtuve ${resp.status}`);
      }

      const conIpPublica = await request(app)
        .post(`/api/proyectos/${proyectoId}/webhooks`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'Público', url: URL_PUBLICA_VALIDA, proveedor: 'generico', eventos: ['hu_reportada'] });
      assert.equal(conIpPublica.status, 201, 'una IP pública real no debe bloquearse por el guard de SSRF');
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

  describe('acciones de criterio ya NO disparan webhooks automáticamente', () => {
    it('aprobar/rechazar/solucionar/cerrar_caso/reabrir un criterio no generan ninguna entrega', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'] });
      const { criterioId } = await crearHistoriaConCriterio();
      await finalizar(criterioId);
      await rechazar(criterioId, 'No debería disparar nada');
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'solucionar' });
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'cerrar_caso' });
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'reabrir' });

      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(mock.requests.length, 0, 'ninguna acción de criterio debe disparar un webhook por sí sola');
    });
  });

  describe('reportar-webhook por Historia de Usuario (botón manual)', () => {
    it('requiere capacidad aprobar_rechazar (403 para Dev, 200 para QA)', async () => {
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU para botón webhook');
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      const sinCapacidad = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.dev}`);
      assert.equal(sinCapacidad.status, 403);

      const conCapacidad = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(conCapacidad.status, 200);
    });

    it('una HU sin criterios de aceptación -> 400', async () => {
      const historia = await request(app)
        .post(`/api/requerimientos/${requerimientoId}/historias`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ texto: 'HU sin criterios' });

      const resp = await request(app)
        .post(`/api/historias/${historia.body.id}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(resp.status, 400);
    });

    it('sin token -> 401; historiaId malformado -> 400; cross-tenant -> 404', async () => {
      const { historiaId } = await crearHistoriaConCriterio('HU seguridad');

      const sinToken = await request(app).post(`/api/historias/${historiaId}/reportar-webhook`);
      assert.equal(sinToken.status, 401);

      const malformado = await request(app)
        .post('/api/historias/no-es-un-objectid/reportar-webhook')
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(malformado.status, 400);

      const regB = await registrarTenant(app, { nombreTenant: 'Tenant Webhooks C', email: 'admin@webhooksc.com' });
      const cruzado = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${regB.body.token}`);
      assert.equal(cruzado.status, 404);
    });

    it('con todos los criterios APROBADOS: resultado "aprobada", sin lista de rechazados, dispara hu_reportada', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'] });
      const { historiaId, criterioId } = await crearHistoriaConCriterio('Como QA quiero verificar');
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      const resp = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(resp.status, 200);
      assert.equal(resp.body.evento, 'hu_reportada');
      assert.equal(resp.body.resultado, 'aprobada');
      assert.deepEqual(resp.body.criterios_rechazados, []);
      assert.equal(resp.body.proyecto, 'Proyecto Demo');
      assert.equal(resp.body.modulo, 'Catálogo');
      assert.match(resp.body.hu, /Como QA quiero verificar/);
      assert.match(resp.body.url_hu, new RegExp(`/modulos/${moduloId}\\?hu=${historiaId}$`));
      assert.equal(resp.body.webhooksNotificados, 1);

      await esperarHasta(() => mock.requests.length >= 1);
      const payload = mock.requests[0].body;
      assert.equal(payload.evento, 'hu_reportada');
      assert.equal(payload.resultado, 'aprobada');
    });

    it('con un criterio RECHAZADO: resultado "rechazada" con el comentario más reciente de ese criterio', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'] });
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU con rechazo para reportar');
      await finalizar(criterioId);
      await rechazar(criterioId, 'Primer comentario');
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ columna: 'Desarrollo', accion: 'solucionar' });
      await rechazar(criterioId, 'Comentario más reciente', base.tokens.qa);

      const resp = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(resp.status, 200);
      assert.equal(resp.body.resultado, 'rechazada');
      assert.equal(resp.body.criterios_rechazados.length, 1);
      assert.equal(resp.body.criterios_rechazados[0].comentario, 'Comentario más reciente');

      await esperarHasta(() => mock.requests.length >= 1);
      assert.deepEqual(mock.requests[0].body.criterios_rechazados, resp.body.criterios_rechazados);
    });

    it('proveedor google_chat: card compacta con estado, lista de rechazados y botón "Abrir HU"', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'], proveedor: 'google_chat' });
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU formato Google Chat');
      await finalizar(criterioId);
      await rechazar(criterioId, 'Falla visible en la card');

      const resp = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(resp.status, 200);

      await esperarHasta(() => mock.requests.length >= 1);
      const card = mock.requests[0].body.cardsV2[0].card;
      assert.match(card.header.title, /Proyecto Demo/);
      assert.match(card.header.title, /HU-\d+/);
      const widgets = card.sections[0].widgets;
      assert.ok(widgets.some((w) => w.decoratedText?.text === '❌ Rechazada'));
      assert.ok(widgets.some((w) => w.textParagraph?.text.includes('Falla visible en la card')));
      const boton = widgets.find((w) => w.buttonList)?.buttonList.buttons[0];
      assert.equal(boton.text, 'Abrir HU');
      assert.equal(boton.onClick.openLink.url, resp.body.url_hu);
    });

    it('un webhook desactivado no recibe notificaciones', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'], activo: false });
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU webhook desactivado');
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      const resp = await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);
      assert.equal(resp.body.webhooksNotificados, 0);

      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(mock.requests.length, 0);
    });

    it('un webhook no suscrito a hu_reportada no recibe notificaciones', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU webhook no suscrito');
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);

      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(mock.requests.length, 0);
    });

    it('reintenta ante fallas transitorias y termina entregando (2 fallos + 1 éxito = 3 intentos)', async () => {
      await crearWebhookDirecto({ eventos: ['hu_reportada'] });
      mock.setComportamiento((n) => (n < 3 ? 500 : 200));
      const { historiaId, criterioId } = await crearHistoriaConCriterio('HU con reintentos');
      await finalizar(criterioId);
      await request(app)
        .post(`/api/criterios/${criterioId}/check`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ columna: 'QA', accion: 'aprobar' });

      await request(app)
        .post(`/api/historias/${historiaId}/reportar-webhook`)
        .set('Authorization', `Bearer ${base.tokens.qa}`);

      await esperarHasta(() => mock.requests.length >= 3, { timeoutMs: 3000 });
      assert.equal(mock.requests.length, 3, 'debe haber reintentado hasta entregar en el 3er intento');
    });
  });

  describe('reportar-prueba', () => {
    it('requiere capacidad aprobar_rechazar (403 para Dev, 200 para QA)', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });
      const { historiaId } = await crearHistoriaConCriterio('HU para reportar');

      const sinCapacidad = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.dev}`)
        .send({ modulos: [{ moduloId, historiaIds: [historiaId] }], resultado: 'exitosa' });
      assert.equal(sinCapacidad.status, 403);

      const conCapacidad = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId, historiaIds: [historiaId] }], resultado: 'exitosa' });
      assert.equal(conCapacidad.status, 200);
    });

    it('valida moduloId (en cada elemento de modulos), historiaIds y resultado', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });
      const { historiaId } = await crearHistoriaConCriterio('HU validación');

      const moduloInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId: '507f1f77bcf86cd799439011', historiaIds: [historiaId] }], resultado: 'exitosa' });
      assert.equal(moduloInvalido.status, 400);

      const sinHistorias = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId, historiaIds: [] }], resultado: 'exitosa' });
      assert.equal(sinHistorias.status, 400);

      const resultadoInvalido = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId, historiaIds: [historiaId] }], resultado: 'mas_o_menos' });
      assert.equal(resultadoInvalido.status, 400);

      const otroModulo = await request(app)
        .post(`/api/proyectos/${proyectoId}/modulos`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'Otro módulo' });
      const historiaDeOtroModulo = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId: otroModulo.body.id, historiaIds: [historiaId] }], resultado: 'exitosa' });
      assert.equal(historiaDeOtroModulo.status, 400);
    });

    it('arma el resumen con los CA rechazados (comentario más reciente) y dispara prueba_reportada', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });

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
          modulos: [{ moduloId, historiaIds: [historiaId, historiaIdOk] }],
          resultado: 'con_errores',
          comentario: 'Probado en staging',
        });
      assert.equal(resp.status, 200);
      assert.equal(resp.body.evento, 'prueba_reportada');
      assert.equal(resp.body.resultado, 'con_errores');
      assert.equal(resp.body.modulos.length, 1);
      assert.equal(resp.body.modulos[0].historias.length, 2);
      assert.equal(resp.body.modulos[0].historias[0].criterios.length, 1);
      assert.equal(resp.body.modulos[0].historias[0].criterios[0].estado, 'RECHAZADO');
      assert.equal(resp.body.webhooksNotificados, 1);

      await esperarHasta(() => mock.requests.length >= 1);
      assert.equal(mock.requests[0].body.evento, 'prueba_reportada');
      assert.equal(mock.requests[0].body.modulos[0].historias[0].criterios[0].estado, 'RECHAZADO');
    });

    it('sin token -> 401; id de proyecto malformado -> 400', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });

      const sinToken = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .send({ modulos: [{ moduloId, historiaIds: ['507f1f77bcf86cd799439011'] }], resultado: 'exitosa' });
      assert.equal(sinToken.status, 401);

      const idMalformado = await request(app)
        .post('/api/proyectos/no-es-un-objectid/reportar-prueba')
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId, historiaIds: ['507f1f77bcf86cd799439011'] }], resultado: 'exitosa' });
      assert.equal(idMalformado.status, 400);
    });

    it('sin webhooks configurados -> 400 con mensaje claro', async () => {
      const { historiaId } = await crearHistoriaConCriterio('HU sin webhooks');

      const resp = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({ modulos: [{ moduloId, historiaIds: [historiaId] }], resultado: 'exitosa' });
      assert.equal(resp.status, 400);
      assert.ok(
        resp.body.error.includes('webhooks'),
        'mensaje de error debe mencionar webhooks',
      );
    });

    it('agregar múltiples módulos en un solo reporte (nuevo agregador)', async () => {
      await crearWebhookDirecto({ eventos: ['prueba_reportada'] });

      // Crear un segundo módulo
      const modulo2 = await request(app)
        .post(`/api/proyectos/${proyectoId}/modulos`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ nombre: 'Segundo módulo' });
      const moduloId2 = modulo2.body.id;

      const req2 = await request(app)
        .post(`/api/modulos/${moduloId2}/requerimientos`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ titulo: 'Editar producto', descripcionResumida: 'desc' });
      const requerimientoId2 = req2.body.id;

      // Historias en módulo 1
      const { historiaId: hu1, criterioId: ca1 } = await crearHistoriaConCriterio('HU1 en M1');
      await finalizar(ca1);
      await rechazar(ca1, 'Problema en M1');

      // Historias en módulo 2
      const hu2Resp = await request(app)
        .post(`/api/requerimientos/${requerimientoId2}/historias`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ texto: 'HU1 en M2' });
      const hu2 = hu2Resp.body.id;
      const ca2Resp = await request(app)
        .post(`/api/historias/${hu2}/criterios`)
        .set('Authorization', `Bearer ${base.tokens.admin}`)
        .send({ texto: 'Debe funcionar' });
      const ca2 = ca2Resp.body.id;
      await finalizar(ca2, base.tokens.dev);
      await rechazar(ca2, 'Problema en M2', base.tokens.qa);

      // Reportar ambos módulos de una vez
      const resp = await request(app)
        .post(`/api/proyectos/${proyectoId}/reportar-prueba`)
        .set('Authorization', `Bearer ${base.tokens.qa}`)
        .send({
          modulos: [
            { moduloId, historiaIds: [hu1] },
            { moduloId: moduloId2, historiaIds: [hu2] },
          ],
          resultado: 'con_errores',
          comentario: 'Errores en ambos módulos',
        });
      assert.equal(resp.status, 200);
      assert.equal(resp.body.evento, 'prueba_reportada');
      assert.equal(resp.body.modulos.length, 2);
      assert.equal(resp.body.modulos[0].nombre, 'Catálogo');
      assert.equal(resp.body.modulos[1].nombre, 'Segundo módulo');
      assert.ok(resp.body.modulos[0].historias[0].codigo.match(/^HU-\d+$/), 'primer módulo debe tener HU con código HU-N');
      assert.equal(resp.body.modulos[0].historias[0].criterios.length, 1);
      assert.equal(resp.body.modulos[0].historias[0].criterios[0].estado, 'RECHAZADO');
      assert.equal(resp.body.modulos[1].historias[0].criterios.length, 1);
      assert.equal(resp.body.modulos[1].historias[0].criterios[0].estado, 'RECHAZADO');

      await esperarHasta(() => mock.requests.length >= 1);
      assert.equal(mock.requests[0].body.modulos.length, 2);
      assert.equal(mock.requests[0].body.modulos[0].historias[0].criterios[0].estado, 'RECHAZADO');
      assert.equal(mock.requests[0].body.modulos[1].historias[0].criterios[0].estado, 'RECHAZADO');
    });
  });
});
