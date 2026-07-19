require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
}

module.exports = {
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  uploadsPath: process.env.UPLOADS_PATH || './uploads',
  port: Number(process.env.PORT) || 4000,
  maxImageMb: Number(process.env.MAX_IMAGE_MB) || 10,
  maxVideoMb: Number(process.env.MAX_VIDEO_MB) || 100,
};
