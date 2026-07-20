// Capacidades que un rol puede tener DENTRO de un proyecto (vía el equipo del proyecto).
// admin_tenant NO vive acá: se modela como el flag `esAdmin` a nivel de usuario (ver CLAUDE.md).
module.exports = ['gestionar_contenido', 'marcar_finalizado', 'aprobar_rechazar', 'solo_lectura'];
