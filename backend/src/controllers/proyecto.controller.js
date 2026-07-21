const proyectoService = require('../services/proyecto.service');

async function listar(req, res, next) {
  try {
    res.json(await proyectoService.listar(req.auth.tenantId, req.auth));
  } catch (err) {
    next(err);
  }
}

async function obtener(req, res, next) {
  try {
    res.json(await proyectoService.obtener(req.auth.tenantId, req.params.id, req.auth));
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    res.status(201).json(await proyectoService.crear(req.auth.tenantId, req.body));
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    res.json(await proyectoService.actualizar(req.auth.tenantId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    res.json(await proyectoService.eliminar(req.auth.tenantId, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function actualizarEquipo(req, res, next) {
  try {
    res.json(
      await proyectoService.actualizarEquipo(req.auth.tenantId, req.params.id, req.body, req.auth.usuarioId),
    );
  } catch (err) {
    next(err);
  }
}

async function actualizarColumnasCheck(req, res, next) {
  try {
    res.json(await proyectoService.actualizarColumnasCheck(req.auth.tenantId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, actualizarEquipo, actualizarColumnasCheck };
