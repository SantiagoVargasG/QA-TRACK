// Datos semilla mínimos: 1 tenant demo con 1 único usuario admin, cuenta base para que ese
// admin autogestione el resto de las pruebas desde la propia UI (crear proyectos, equipo,
// usuarios adicionales, etc.) en vez de que el seed genere contenido de ejemplo. Idempotente:
// si el tenant demo ya existe, no hace nada (para no duplicar datos ni pisar una demo en uso).
require('dotenv').config();

const connectDB = require('./config/db');
const Tenant = require('./models/Tenant');
const authService = require('./services/auth.service');

const SLUG_DEMO = 'demo';
const EMAIL_ADMIN = 'admin@demo.test';
const PASSWORD_ADMIN = 'Admin123*';

async function seed() {
  await connectDB();

  const existente = await Tenant.findOne({ slug: SLUG_DEMO });
  if (existente) {
    console.log(`Ya existe un tenant demo (slug "${SLUG_DEMO}") — no se vuelve a crear.`);
    console.log('Si querés datos frescos, borralo manualmente de la base y volvé a correr el seed.');
    process.exit(0);
  }

  await authService.registrarTenant({
    nombreTenant: 'Demo',
    nombreUsuario: 'Admin Demo',
    email: EMAIL_ADMIN,
    password: PASSWORD_ADMIN,
  });

  console.log('Datos semilla creados:');
  console.log(`  Tenant: Demo (slug: "${SLUG_DEMO}")`);
  console.log(`  Admin:  ${EMAIL_ADMIN} / ${PASSWORD_ADMIN}`);
  console.log('  Usá esta cuenta para crear proyectos, equipo y usuarios adicionales desde la UI.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error al ejecutar el seed:', err.message);
  process.exit(1);
});
