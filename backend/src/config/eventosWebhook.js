// Eventos configurables por webhook. `hu_reportada` reemplaza a los 4 eventos disparados
// automáticamente por cada acción de criterio (criterio_aprobado/criterio_rechazado/
// caso_solucionado/caso_cerrado) — decisión post-MVP: esos disparos automáticos generaban
// demasiado ruido (un mensaje por cada check individual); ahora el envío es una acción manual
// por Historia de Usuario ("Enviar a webhook" en el frontend), ver
// webhookService.reportarHistoria().
module.exports = ['hu_reportada', 'prueba_reportada'];
