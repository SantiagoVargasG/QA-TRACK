// Datos semilla de demostración (PRD sección 11): 1 tenant demo, roles semilla (ya los crea
// authService.registrarTenant), 1 proyecto con 2 módulos, un requerimiento y una HU con un CA
// de ejemplo en cada uno. Idempotente: si el tenant demo ya existe, no hace nada (para no
// duplicar datos ni pisar cambios manuales en una demo ya usada).
require('dotenv').config();

const connectDB = require('./config/db');
const Tenant = require('./models/Tenant');
const Rol = require('./models/Rol');
const authService = require('./services/auth.service');
const usuarioService = require('./services/usuario.service');
const proyectoService = require('./services/proyecto.service');
const moduloService = require('./services/modulo.service');
const requerimientoService = require('./services/requerimiento.service');
const historiaService = require('./services/historia.service');
const criterioService = require('./services/criterio.service');

const SLUG_DEMO = 'demo';
const PASSWORD_DEMO = 'demo12345';

const MODULOS_DEMO = [
  { nombre: 'Catálogo', descripcion: 'Gestión de productos y categorías' },
  { nombre: 'Pedidos', descripcion: 'Flujo de compra y checkout' },
];

async function seed() {
  await connectDB();

  const existente = await Tenant.findOne({ slug: SLUG_DEMO });
  if (existente) {
    console.log(`Ya existe un tenant demo (slug "${SLUG_DEMO}") — no se vuelve a crear.`);
    console.log('Si querés datos frescos, borralo manualmente de la base y volvé a correr el seed.');
    process.exit(0);
  }

  const { tenant, usuario: admin } = await authService.registrarTenant({
    nombreTenant: 'Demo',
    nombreUsuario: 'Admin Demo',
    email: 'admin@demo.com',
    password: PASSWORD_DEMO,
  });
  const tenantId = tenant.id.toString();
  const authAdmin = { tenantId, usuarioId: admin.id.toString(), esAdmin: true };

  const roles = await Rol.find({ tenantId });
  const rolDev = roles.find((r) => r.nombre === 'Dev');
  const rolQA = roles.find((r) => r.nombre === 'QA');

  const dev = await usuarioService.crear(tenantId, {
    nombre: 'Dev Demo',
    email: 'dev@demo.com',
    password: PASSWORD_DEMO,
  });
  const qa = await usuarioService.crear(tenantId, {
    nombre: 'QA Demo',
    email: 'qa@demo.com',
    password: PASSWORD_DEMO,
  });

  const proyecto = await proyectoService.crear(tenantId, {
    nombre: 'Proyecto Demo',
    descripcion: 'Proyecto de ejemplo para explorar la plataforma',
  });
  await proyectoService.actualizarEquipo(
    tenantId,
    proyecto.id.toString(),
    {
      equipo: [
        { usuarioId: dev.id.toString(), rolId: rolDev._id.toString() },
        { usuarioId: qa.id.toString(), rolId: rolQA._id.toString() },
      ],
    },
    authAdmin.usuarioId,
  );

  // eslint-disable-next-line no-restricted-syntax
  for (const datosModulo of MODULOS_DEMO) {
    // eslint-disable-next-line no-await-in-loop
    const modulo = await moduloService.crear(tenantId, proyecto.id.toString(), authAdmin, datosModulo);
    // eslint-disable-next-line no-await-in-loop
    const requerimiento = await requerimientoService.crear(tenantId, modulo.id.toString(), authAdmin, {
      titulo: `Requerimiento de ejemplo — ${datosModulo.nombre}`,
      descripcionResumida: `Requerimiento de demostración para el módulo ${datosModulo.nombre}.`,
    });
    // eslint-disable-next-line no-await-in-loop
    const historia = await historiaService.crear(tenantId, requerimiento.id.toString(), authAdmin, {
      texto: `Como usuario, quiero usar ${datosModulo.nombre.toLowerCase()}, para probar la plataforma`,
    });
    // eslint-disable-next-line no-await-in-loop
    await criterioService.crear(tenantId, historia.id.toString(), authAdmin, {
      texto: 'El sistema debe responder correctamente ante la acción principal del flujo',
    });
  }

  console.log('Datos semilla creados:');
  console.log(`  Tenant: Demo (slug: "${SLUG_DEMO}")`);
  console.log(`  Admin:  admin@demo.com / ${PASSWORD_DEMO}`);
  console.log(`  Dev:    dev@demo.com / ${PASSWORD_DEMO}`);
  console.log(`  QA:     qa@demo.com / ${PASSWORD_DEMO}`);
  console.log('  Proyecto: "Proyecto Demo" con 2 módulos, cada uno con 1 requerimiento, 1 HU y 1 CA.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error al ejecutar el seed:', err.message);
  process.exit(1);
});
