// Límite pequeño para poder probar el rechazo por tamaño sin subir archivos gigantes; se
// setea ANTES de requerir entorno/app porque utils/evidencias.js lee la env var al cargar
// el módulo (node --test aísla cada archivo en su propio proceso, así que no afecta a otras
// suites) — mismo patrón que tests/reportes.test.js.
process.env.MAX_IMAGE_MB = '1';
process.env.MAX_VIDEO_MB = '2';

const fs = require('fs');
const path = require('path');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const entorno = require('./helpers/entorno');
const { registrarTenant, crearTenantConEquipoBase, crearProyectoConEquipo } = require('./helpers/fixtures');

describe('comentarios: notas libres sobre un criterio, sin pasar por la máquina de estados', () => {
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
    fs.rmSync(path.join(process.env.UPLOADS_PATH, base.tenantId), { recursive: true, force: true });
  });

  it('cualquier miembro del proyecto puede comentar, incluido Lector, con el criterio en PENDIENTE', async () => {
    const criterioId = await crearCriterio();

    for (const token of [base.tokens.dev, base.tokens.qa, base.tokens.lector, base.tokens.admin]) {
      const resp = await request(app)
        .post(`/api/criterios/${criterioId}/comentarios`)
        .set('Authorization', `Bearer ${token}`)
        .send({ texto: 'Un comentario libre' });
      assert.equal(resp.status, 201);
      assert.equal(resp.body.texto, 'Un comentario libre');
      assert.ok(resp.body.fecha);
    }

    const listado = await request(app)
      .get(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(listado.status, 200);
    assert.equal(listado.body.length, 4);
  });

  it('comentar no cambia el estado del criterio ni genera un Reporte', async () => {
    const criterioId = await crearCriterio();

    await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ texto: 'Esto es solo una nota, no un rechazo' });

    const historiaResp = await request(app)
      .get(`/api/historias/${historiaId}/criterios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    const criterio = historiaResp.body.find((c) => c.id === criterioId);
    assert.equal(criterio.estado, 'PENDIENTE', 'comentar no debe transicionar el criterio');

    const reportes = await request(app)
      .get(`/api/criterios/${criterioId}/reportes`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.deepEqual(reportes.body, [], 'un comentario libre no debe generar un Reporte');
  });

  it('un forastero (fuera del equipo, sin esAdmin) recibe 404 al listar o comentar', async () => {
    const criterioId = await crearCriterio();

    const listado = await request(app)
      .get(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.forastero}`);
    assert.equal(listado.status, 404);

    const crear = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.forastero}`)
      .send({ texto: 'No debería poder' });
    assert.equal(crear.status, 404);
  });

  it('texto requerido, tipo string y longitud máxima de 2000 caracteres', async () => {
    const criterioId = await crearCriterio();

    const sinTexto = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({});
    assert.equal(sinTexto.status, 400);

    const noString = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 12345 });
    assert.equal(noString.status, 400);

    const muyLargo = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 'a'.repeat(2001) });
    assert.equal(muyLargo.status, 400);
  });

  it('el orden es cronológico (más viejo primero), igual que el resto del histórico', async () => {
    const criterioId = await crearCriterio();
    await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 'Primero' });
    await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ texto: 'Segundo' });

    const listado = await request(app)
      .get(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.deepEqual(
      listado.body.map((c) => c.texto),
      ['Primero', 'Segundo'],
    );
  });

  it('sin token -> 401 en listar y en crear', async () => {
    const criterioId = await crearCriterio();
    const listado = await request(app).get(`/api/criterios/${criterioId}/comentarios`);
    assert.equal(listado.status, 401);
    const crear = await request(app).post(`/api/criterios/${criterioId}/comentarios`).send({ texto: 'x' });
    assert.equal(crear.status, 401);
  });

  it('id malformado en :id -> 400', async () => {
    const resp = await request(app)
      .get('/api/criterios/no-es-un-id/comentarios')
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(resp.status, 400);
  });

  it('cross-tenant: admin de otro tenant recibe 404 al listar o comentar', async () => {
    const criterioId = await crearCriterio();
    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Comentarios B', email: 'admin@comentariosb.com' });

    const listado = await request(app)
      .get(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(listado.status, 404);

    const crear = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${regB.body.token}`)
      .send({ texto: 'x' });
    assert.equal(crear.status, 404);
  });

  it('se puede comentar aunque el criterio ya esté APROBADO (igual que el histórico de reportes)', async () => {
    const criterioId = await crearCriterio();
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ columna: 'Desarrollo', accion: 'finalizar' });
    await request(app)
      .post(`/api/criterios/${criterioId}/check`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .send({ columna: 'QA', accion: 'aprobar' });

    const resp = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .send({ texto: 'Nota tardía sobre un CA ya aprobado' });
    assert.equal(resp.status, 201);
  });

  it('evidencias en un comentario: imagen válida se sube y queda referenciada; MIME no permitido -> 400; tamaño excede el máximo de su tipo -> 400 (mismos límites que un rechazo)', async () => {
    const criterioId = await crearCriterio();
    const conEvidencia = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .field('texto', 'Ver captura adjunta')
      .attach('evidencias', Buffer.from('contenido-de-prueba'), {
        filename: 'captura.png',
        contentType: 'image/png',
      });
    assert.equal(conEvidencia.status, 201);
    assert.equal(conEvidencia.body.evidencias.length, 1);
    assert.equal(conEvidencia.body.evidencias[0].tipoMime, 'image/png');

    const listado = await request(app)
      .get(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.admin}`);
    assert.equal(listado.body.at(-1).evidencias.length, 1, 'la evidencia debe quedar referenciada al listar');

    const criterioMime = await crearCriterio();
    const mimeInvalido = await request(app)
      .post(`/api/criterios/${criterioMime}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .field('texto', 'x')
      .attach('evidencias', Buffer.from('contenido'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    assert.equal(mimeInvalido.status, 400);

    const criterioTamano = await crearCriterio();
    // MAX_IMAGE_MB=1 en este archivo de test (ver override al inicio) — 1.5MB excede el
    // máximo de imagen, igual que en tests/reportes.test.js.
    const bufferGrande = Buffer.alloc(1.5 * 1024 * 1024);
    const tamanoExcedido = await request(app)
      .post(`/api/criterios/${criterioTamano}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.dev}`)
      .field('texto', 'x')
      .attach('evidencias', bufferGrande, { filename: 'grande.png', contentType: 'image/png' });
    assert.equal(tamanoExcedido.status, 400);
  });

  it('GET /uploads/:archivo sirve una evidencia de comentario igual que una de reporte; cross-tenant -> 404', async () => {
    const criterioId = await crearCriterio();
    const conEvidencia = await request(app)
      .post(`/api/criterios/${criterioId}/comentarios`)
      .set('Authorization', `Bearer ${base.tokens.qa}`)
      .field('texto', 'Ver captura')
      .attach('evidencias', Buffer.from('contenido-de-prueba'), {
        filename: 'captura2.png',
        contentType: 'image/png',
      });
    const archivo = conEvidencia.body.evidencias[0].archivo;

    const sirve = await request(app)
      .get(`/api/uploads/${archivo}`)
      .set('Authorization', `Bearer ${base.tokens.dev}`);
    assert.equal(sirve.status, 200);

    const regB = await registrarTenant(app, { nombreTenant: 'Tenant Comentarios C', email: 'admin@comentariosc.com' });
    const cruzado = await request(app)
      .get(`/api/uploads/${archivo}`)
      .set('Authorization', `Bearer ${regB.body.token}`);
    assert.equal(cruzado.status, 404);
  });
});
