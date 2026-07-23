require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
}

module.exports = {
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  // Jornada laboral razonable por defecto — antes estaba hardcodeado a '8h' en
  // token.service.js; ahora es configurable para poder ajustarlo sin tocar código.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadsPath: process.env.UPLOADS_PATH || './uploads',
  port: Number(process.env.PORT) || 4000,
  maxImageMb: Number(process.env.MAX_IMAGE_MB) || 10,
  maxVideoMb: Number(process.env.MAX_VIDEO_MB) || 100,
  // Origen del frontend, usado para armar el deep link a una HU en el payload de webhooks
  // (ver webhookService.reportarHistoria) — nunca se infiere de un header de request.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
};
