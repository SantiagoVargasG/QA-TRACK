# Checklist obligatorio antes de reportar una iteración como completa

Construido a partir de los hallazgos de las auditorías de las Iteraciones 0 y 1. Cada punto es una
verificación **accionable**, no una aspiración: si algo no aplica a la iteración actual, decirlo
explícitamente (`N/A: <razón>`) en vez de omitirlo en silencio.

Este documento crece con cada iteración: tras cada auditoría aprobada, los patrones nuevos que haya
identificado se agregan aquí antes de cerrarla.

## Seguridad

- [ ] **Ningún filtro de Mongo recibe un valor de cliente sin validar `typeof === 'string'` primero**
  (`Modelo.findOne({ campo: valorDeCliente })`). Un objeto como `{"$ne": null}` se interpreta como
  operador de consulta, no como valor literal. Usar `stringParaFiltro()` de
  `backend/src/utils/validacion.js`.
- [ ] **Todo campo booleano de entrada se valida con `typeof valor === 'boolean'` estricto, nunca con
  `Boolean(valorDeCliente)`** — `Boolean("false")` es `true` en JS. Usar `booleanoOpcional()` del mismo
  archivo.
- [ ] **`esAdmin`, `activo`, `tenantId` y cualquier otro dato de autorización se leen SIEMPRE de la base
  de datos dentro de `requireAuth`, nunca del payload del JWT.** El JWT solo prueba identidad; una
  desactivación o un cambio de permiso debe surtir efecto de inmediato, no esperar a que expire el token.
- [ ] **Un recurso que pertenece a otro tenant responde 404, nunca 403** (no revelar existencia). La
  misma consulta `findOne({ _id, tenantId })` debe cubrir tanto "no existe" como "existe pero es de otro
  tenant" — indistinguibles para quien pregunta.
- [ ] **Ningún endpoint acepta ni usa un `tenantId` enviado por el cliente** (body/params/query). Todo
  `tenantId` usado en una consulta viene de `req.auth.tenantId`, resuelto desde el JWT verificado.
- [ ] **Un `:id` de ruta malformado responde 400, no 500.** Validar con `validarIdParam()` de
  `backend/src/middleware/validateObjectId.js` antes de tocar la base de datos.
- [ ] **Los errores 500 no controlados responden un mensaje genérico al cliente; el detalle completo se
  loguea solo en servidor.** Los errores intencionales (`ApiError` con status ≠ 500) sí pueden llevar su
  mensaje específico.
- [ ] **JWT se firma y verifica con `algorithms: ['HS256']` explícito** — nunca depender del
  comportamiento por defecto de la librería para rechazar `alg:none`.
- [ ] **Login (o cualquier verificación de credenciales) ejecuta siempre una operación de costo
  equivalente exista o no el recurso** (ej. `bcrypt.compare` contra un hash dummy cuando el
  usuario/tenant no existe), para no abrir un canal de timing que permita enumerar cuentas o tenants.
- [ ] **Validación de entrada completa en cada endpoint que recibe datos de cliente:** campos requeridos
  presentes, tipos correctos, formato de email validado (`validarEmail()`), longitudes máximas
  (`validarLongitudMax()`) — no solo validaciones mínimas (ej. largo mínimo de password).
- [ ] **Cualquier estado "irrecuperable sin acceso directo a la BD" tiene un guard explícito** (ej. no
  puede quedar un tenant sin ningún admin activo; no se puede borrar una entidad de la que otra depende
  de forma irreversible). Ver `contarAdminsActivosExcluyendo()` en `usuario.service.js` como referencia
  del patrón.
- [ ] **Sin dependencias prohibidas** (Redis, colas de mensajes, caché distribuida, librerías de UI
  pesadas) en ningún `package.json` nuevo o modificado.
- [ ] **`npm audit` en 0 vulnerabilidades** (o, si hay alguna inevitable, documentada y justificada
  explícitamente en la entrega, con la alternativa considerada).
- [ ] **Ninguna credencial real (contraseñas, tokens, connection strings) hardcodeada en código fuente ni
  commiteada** — todo vía variables de entorno, con `.env.example` actualizado y `.env` real protegido
  por `.gitignore`.
- [ ] **La conexión a servicios externos (MongoDB, etc.) falla explícitamente si no logra conectar** — el
  proceso no debe arrancar "a medias" ni quedar escuchando sin sus dependencias críticas.

## Calidad

- [ ] **Cada regla de negocio nueva se entrega en la misma iteración con al menos un assert automatizado
  que la cubra** — no queda como "se implementó pero no se probó".
- [ ] **Todo endpoint nuevo incluye asserts de:** aislamiento de tenant (cross-tenant → 404), permisos
  (rol/capacidad correcta → 200, incorrecta → 403, sin token → 401), y validación de tipos de sus campos
  de entrada.
- [ ] **La suite de pruebas completa (no solo los asserts nuevos) se re-ejecuta y queda en verde** antes
  de reportar la iteración como completa — para detectar regresiones en código previo, no solo validar
  lo nuevo.
- [ ] **Para cambios de frontend, se verificó la funcionalidad en un navegador real** (Playwright u otra
  herramienta equivalente), no solo que el código compile o pase linters.

## Documentación

- [ ] **`CLAUDE.md` refleja el estado real construido** (estructura, comandos, qué está implementado) —
  no lo que estaba planeado antes de empezar la iteración.
- [ ] **Toda decisión de diseño no explícita en el PRD queda documentada** (en el PRD si corresponde
  actualizarlo, o en `CLAUDE.md`) con su razón — nunca implementada en silencio.
- [ ] **Cualquier patrón de seguridad o calidad nuevo descubierto en esta iteración se agrega a este
  checklist** antes de cerrarla.

---

Al reportar una iteración como completa, pegar este checklist con cada ítem marcado:
- `[x]` — cumplido.
- `[ ] — N/A: <razón>` — no aplica a esta iteración, con motivo explícito.
- `[ ] — PENDIENTE: <qué falta>` — encontrado pero no resuelto; requiere aprobación del usuario antes de
  continuar a la siguiente iteración.
