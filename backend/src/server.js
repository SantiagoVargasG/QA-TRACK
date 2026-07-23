const app = require('./app');
const connectDB = require('./config/db');
const Usuario = require('./models/Usuario');
const { port } = require('./config/env');

async function start() {
  await connectDB();
  // Sincroniza los índices de Usuario con el schema actual (email único global) en vez de
  // depender solo del autoIndex implícito de Mongoose al primer uso del modelo — así una
  // base con el índice compuesto {tenantId,email} anterior queda corregida al reiniciar.
  await Usuario.syncIndexes();
  app.listen(port, () => {
    console.log(`Backend escuchando en http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
