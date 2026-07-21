const evidenciaService = require('../services/evidencia.service');

async function servir(req, res, next) {
  try {
    const { rutaAbsoluta, tipoMime } = await evidenciaService.resolverArchivo(
      req.auth.tenantId,
      req.auth,
      req.params.archivo,
    );
    res.type(tipoMime);
    res.sendFile(rutaAbsoluta, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { servir };
