const authService = require('../services/auth.service');

async function registrarTenant(req, res, next) {
  try {
    const resultado = await authService.registrarTenant(req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const resultado = await authService.login(req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { registrarTenant, login };
