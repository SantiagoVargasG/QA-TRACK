const { ApiError } = require('../middleware/errorHandler');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(email, nombreCampo = 'email') {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new ApiError(400, `${nombreCampo} no tiene un formato válido`);
  }
}

function validarLongitudMax(valor, nombreCampo, maxLength) {
  if (typeof valor !== 'string') {
    throw new ApiError(400, `${nombreCampo} debe ser texto`);
  }
  if (valor.length > maxLength) {
    throw new ApiError(400, `${nombreCampo} no puede superar los ${maxLength} caracteres`);
  }
}

// Para campos booleanos de entrada: exige true/false estricto. Nunca usar Boolean(valor)
// con datos de cliente — Boolean("false") es `true` en JS y abriría un bypass de control
// de acceso (ver auditoría de seguridad, Iteración 1).
function booleanoOpcional(valor, nombreCampo) {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'boolean') {
    throw new ApiError(400, `${nombreCampo} debe ser true o false`);
  }
  return valor;
}

// Para cualquier valor de cliente que vaya a usarse dentro de un filtro de Mongo (ej.
// Modelo.findOne({ campo: valor })): exige string plano para que un objeto como
// { "$ne": null } no se cuele como operador de consulta.
function stringParaFiltro(valor, nombreCampo) {
  if (valor !== undefined && typeof valor !== 'string') {
    throw new ApiError(400, `${nombreCampo} debe ser texto`);
  }
  return valor;
}

// Para un campo de URL opcional que el servidor NUNCA va a fetch() (ej. un link de diseño
// que solo abre el navegador del usuario al hacer clic): valida formato y protocolo http(s)
// nada más. A diferencia de la URL de un webhook (services/webhook.service.js#validarUrl),
// no necesita resolución DNS ni el guard anti-SSRF — ese guard existe porque el SERVIDOR es
// quien hace la petición saliente; acá nunca lo hace, así que agregarlo sería validación sin
// motivo real. `''` limpia el campo (devuelve ''); `undefined` deja el valor sin tocar.
function validarUrlOpcional(valor, nombreCampo) {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new ApiError(400, `${nombreCampo} debe ser texto`);
  if (valor === '') return '';

  validarLongitudMax(valor, nombreCampo, 500);
  let parsed;
  try {
    parsed = new URL(valor);
  } catch {
    throw new ApiError(400, `${nombreCampo} debe ser una URL http(s) válida`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiError(400, `${nombreCampo} debe ser una URL http(s) válida`);
  }
  return valor;
}

module.exports = { validarEmail, validarLongitudMax, booleanoOpcional, stringParaFiltro, validarUrlOpcional };
