// Máquina de estados del criterio de aceptación (PRD sección 6). El enum completo se
// declara desde ya para no migrar el schema en la Iteración 4; las transiciones hacia
// RECHAZADO/SOLUCIONADO se habilitan recién en esa iteración.
module.exports = ['PENDIENTE', 'FINALIZADO_DEV', 'APROBADO', 'RECHAZADO', 'SOLUCIONADO'];
