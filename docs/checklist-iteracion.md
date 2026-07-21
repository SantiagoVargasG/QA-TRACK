# Checklist obligatorio antes de reportar una iteración como completa

Construido a partir de los hallazgos de las auditorías de las Iteraciones 0, 1 y 2. Cada punto es una
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
- [ ] **Errores de Mongoose que no son `ApiError` se mapean a 400, no al 500 genérico** en el
  `errorHandler` central — un `ValidationError` (schema `required`/`maxlength`/`enum`) o un `CastError`
  (ObjectId malformado en un campo que no pasa por `validarIdParam`, ej. dentro de un array o un campo de
  referencia anidado) deben responder 400 sanitizado, no un 500 con status incorrecto.
- [ ] **Un arreglo de ids de cliente usado en un filtro Mongo valida cada elemento (`typeof === 'string'`)
  explícitamente**, aunque exista después una verificación de "mismo conjunto que los ids reales" — esa
  verificación downstream no reemplaza la validación de tipo aguas arriba.
- [ ] **Todo contador correlativo derivado de `countDocuments` + `create` en dos pasos (ej. el código `HU-N`)
  está protegido contra condición de carrera** con un índice único compuesto que rechace el duplicado (ej.
  `{tenantId, proyectoId, codigo}`), reintentando la operación ante el error `11000` de Mongo en vez de
  dejarlo escalar a un 500 sin controlar. Ver `crear()` en `services/historia.service.js` (detectado en la
  auditoría de Iteración 2: dos requests concurrentes generaban el mismo código).
- [ ] **Toda transición de estado (o cualquier operación "leer estado → validar → escribir" de dos pasos,
  no solo contadores) está protegida contra condición de carrera** con `findOneAndUpdate` atómico que
  incluya el/los estado(s) de origen esperados en el filtro (`{ _id, estado: { $in: origenes } }`) y aplique
  el nuevo estado en el mismo `$set` — nunca un `Modelo.findOne()` + mutación en memoria + `.save()`
  condicionado por un `if` previo, que dos requests concurrentes (doble clic, o dos usuarios actuando casi
  al mismo tiempo) pueden pasar ambas antes de que cualquiera confirme. Si la operación falla (documento no
  matcheado), responder el mismo error que "transición inválida" — no hace falta distinguir al cliente entre
  "ya estaba mal" y "alguien más lo cambió justo ahora". Ver `aplicarCheck()` en
  `services/criterio.service.js` (detectado en la auditoría de Iteración 3+4: dos transiciones concurrentes
  sobre el mismo criterio —ej. dos "rechazar"— aplicaban ambas, duplicando el `Reporte`).
- [ ] **Todo id embebido en el *body* de una request (no en la URL) que se use en un filtro de Mongo se
  prueba también con formato no-ObjectId**, no solo con tipo incorrecto (`stringParaFiltro` cubre "no es
  string", pero no "es string pero no es un ObjectId válido") — para confirmar que el `CastError` resultante
  lo mapea `errorHandler.js` a 400 y no escala a un 500 sin controlar.
- [ ] **Todo endpoint que sirve archivos de disco resuelve el tenant/dueño SIEMPRE desde `auth`, nunca
  desde la URL/body**, y valida el nombre de archivo contra un patrón estricto antes de tocar el
  filesystem (el nombre en disco lo genera el servidor, ej. UUID — cualquier valor que no matchee ese
  patrón no puede ser un archivo real y se rechaza con 400 sin leer el filesystem). Además reverifica
  acceso al recurso de negocio dueño del archivo (proyecto/equipo), no solo que sea del mismo tenant. Ver
  `services/evidencia.service.js` (detectado al implementar `GET /uploads/:archivo` en la Iteración 4).
- [ ] **Cualquier subida de archivos (multer u otro) mapea sus errores propios (`MulterError`) a 400 en el
  `errorHandler` central**, igual que `ValidationError`/`CastError`/`11000` — no debe escalar a un 500 sin
  controlar por un límite de tamaño o cantidad de archivos excedido.
- [ ] **Todo estado de frontend que una ruta necesita para renderizar (no solo el recurso de esa página,
  sino contexto compartido como "proyecto/tenant actual") se carga de forma que sobreviva una recarga
  completa de página o una navegación directa por URL** — nunca depender de que el usuario haya visitado
  antes una página específica que "de paso" precargó ese estado. Verificar recargando (o navegando
  directo) la página más profunda de la jerarquía, no solo el flujo de clics feliz desde el inicio
  (detectado en la Iteración 4: `ProyectoContext` solo cargaba `proyectos` desde `ProyectosPage`, dejando
  `columnasCheck` vacío en silencio al entrar directo a `/modulos/:id`).
- [ ] **Toda integración saliente de latencia/fiabilidad impredecible (webhooks, cualquier `fetch` a un
  sistema externo) se dispara sin `await` desde el flujo que la origina, nunca bloqueando la respuesta al
  usuario** — incluso cuando esa integración incluye reintentos con espera (que pueden sumar decenas de
  segundos). La función que la dispara debe capturar sus propios errores internamente (por integración,
  no solo un catch global) y solo loguear, nunca dejar que un fallo de entrega se propague como error HTTP
  de la operación que la originó. Ver `notificarEventoCriterio()`/`reportarPrueba()` en
  `services/webhook.service.js`, llamadas sin `await` desde `criterio.service.js`.
- [ ] **Toda URL de destino provista por el cliente (ej. la de un webhook) se valida con `new URL()` y se
  restringe a protocolos esperados (`http`/`https`)** antes de guardarla — un valor no parseable como URL
  no debe llegar a usarse en un `fetch` posterior sin que el error ya haya sido detectado en la validación
  de entrada.

## Calidad

- [ ] **Cada regla de negocio nueva se entrega en la misma iteración con al menos un assert automatizado
  que la cubra** — no queda como "se implementó pero no se probó".
- [ ] **Todo endpoint nuevo incluye asserts de crear, listar, actualizar Y eliminar** (las cuatro
  operaciones, no solo crear/listar) **de:** aislamiento de tenant (cross-tenant → 404), permisos
  (rol/capacidad correcta → 200, incorrecta → 403, sin token → 401), y validación de tipos de sus campos
  de entrada. En un recurso con jerarquía anidada (proyecto → módulo → requerimiento → historia), esto
  aplica a cada nivel, no solo al de más arriba.
- [ ] **La suite de pruebas completa (no solo los asserts nuevos) se re-ejecuta y queda en verde** antes
  de reportar la iteración como completa — para detectar regresiones en código previo, no solo validar
  lo nuevo.
- [ ] **Para cambios de frontend, se verificó la funcionalidad en un navegador real** (Playwright u otra
  herramienta equivalente), no solo que el código compile o pase linters.
- [ ] **Ningún archivo de frontend invoca un endpoint que no está registrado en las rutas del backend de la
  iteración actual.** Antes de reportar una iteración de frontend como completa, verificar que cada llamada
  a `apiFetch`/`fetch` en el código nuevo o modificado corresponde a una ruta ya montada en `app.js` — si se
  adelanta UI para una iteración futura, debe quedar detrás de un flag o comentario explícito, nunca
  alcanzable desde la navegación normal (detectado en la auditoría de Iteración 2: `ModuloDetallePage.jsx`
  invocaba endpoints de criterios que, al momento de esa auditoría, aún no existían en el backend).

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
