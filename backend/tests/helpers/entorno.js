// Arranca una MongoDB real en memoria (mongodb-memory-server) y conecta Mongoose antes
// de requerir la app — así los tests ejercitan el mismo código de producción (rutas,
// controladores, servicios, modelos) contra una base real, no contra mocks.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-no-usar-en-produccion';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'placeholder-se-reemplaza-en-iniciar';
process.env.UPLOADS_PATH = process.env.UPLOADS_PATH || './uploads';
process.env.PORT = process.env.PORT || '0';

const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

async function iniciar() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  // eslint-disable-next-line global-require
  return require(path.join(__dirname, '..', '..', 'src', 'app.js'));
}

async function detener() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { iniciar, detener };
