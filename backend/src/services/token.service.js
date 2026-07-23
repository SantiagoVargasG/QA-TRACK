const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const ALGORITMO = 'HS256';

function firmarToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn, algorithm: ALGORITMO });
}

function verificarToken(token) {
  return jwt.verify(token, jwtSecret, { algorithms: [ALGORITMO] });
}

module.exports = { firmarToken, verificarToken };
