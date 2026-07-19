const dns = require('dns');
const mongoose = require('mongoose');
const { mongodbUri } = require('./env');

// En algunos entornos (VPN/DNS corporativo) el resolver DNS por defecto de Node
// no soporta las consultas SRV/TXT que requiere "mongodb+srv://", aunque el
// resolver del sistema operativo sí funciona. Forzar un DNS público evita ese fallo.
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    console.error('Error de conexión a MongoDB:', err.message);
  });

  await mongoose.connect(mongodbUri);
  console.log('Conectado a MongoDB');
}

module.exports = connectDB;
