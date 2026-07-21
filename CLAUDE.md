# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Iteraciones 0 a 6 completadas — **MVP completo** según el alcance del PRD (sección 11). El PRD en
[`docs/PRD-plataforma-seguimiento-qa.md`](docs/PRD-plataforma-seguimiento-qa.md) sigue siendo la
**fuente de verdad** del producto a construir — léelo completo antes de tocar código de dominio.

Estructura actual (`backend/src/`): capas `routes/controllers/services/models/middleware/config/utils`,
todas con contenido real (ya no quedan carpetas vacías). `frontend/src/`: `context/`, `components/`,
`pages/`, `api/`.

Comandos para levantar cada parte:
```
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:4000
cd frontend && npm install && npm run dev                          # http://localhost:5173 (proxy /api -> backend)
```

Pruebas del backend (obligatorias antes de reportar cualquier iteración como completa — ver
[`docs/checklist-iteracion.md`](docs/checklist-iteracion.md)):
```
cd backend && npm test   # node --test contra tests/**/*.test.js
```
Cada archivo en `backend/tests/` levanta su propia MongoDB real en memoria (`mongodb-memory-server`) y
ejercita la app completa vía `supertest` — no hay mocks de la capa de datos. Ver `tests/helpers/entorno.js`
(arranca/detiene la base en memoria) y `tests/helpers/fixtures.js` (tenant + equipo Dev/QA/Lector +
forastero, reutilizado por los tests de proyectos/módulos/requerimientos/historias/criterios/reportes/
webhooks/auditoría). 109 tests en 15 suites, todos en verde.

Implementado hasta la Iteración 6 (MVP completo):
- **Iteración 0:** esqueleto Express con manejo de errores consistente y `GET /api/health`; conexión a
  MongoDB que falla explícitamente si no logra conectar; frontend con layout base.
- **Iteración 1:** multitenancy, autenticación JWT, roles dinámicos con capacidades, CRUD de
  usuarios/roles con control por `esAdmin`. Endurecida con una auditoría de seguridad dirigida (ver
  sección "Seguridad: patrones obligatorios" más abajo).
- **Iteración 2:** proyectos (con equipo y columnas de check), módulos (con reordenamiento), requerimientos
  e historias de usuario (con código `HU-N` autogenerado). Todo el árbol de contenido usa borrado lógico
  (`activo: Boolean`) y control de acceso por membresía de equipo + capacidad de rol *dentro del
  proyecto* — ver `services/acceso.service.js` (`cargarProyectoConAcceso`, `verificarCapacidadEnProyecto`,
  `cargarModuloConAcceso`, `cargarRequerimientoConAcceso`, `cargarHistoriaConAcceso`,
  `cargarCriterioConAcceso`), el punto de entrada obligatorio para cualquier ruta anidada bajo un
  proyecto — las cinco entidades de contenido (proyecto/módulo/requerimiento/historia/criterio) siguen el
  mismo patrón sin excepciones.
- Auditoría de Iteración 2 (ver historial de conversación): se detectó y corrigió una condición de carrera
  en el código `HU-N` (dos creaciones concurrentes podían generar el mismo código — ver índice único en
  `models/Historia.js` y el reintento en `crear()` de `services/historia.service.js`), se persistió como
  suite de pruebas (`backend/tests/`) todo lo que hasta entonces se había verificado en arneses temporales
  de auditoría, y se corrigió `historia.service.js` para usar `cargarHistoriaConAcceso` (antes duplicaba
  esa lógica en vez de reutilizar el patrón de `acceso.service.js`).
- **Iteración 3:** criterios de aceptación (`models/Criterio.js`, `services/criterio.service.js`) con CRUD
  completo y el **camino feliz** de la máquina de estados (`PENDIENTE → FINALIZADO_DEV → APROBADO`) vía
  `POST /criterios/:id/check`. El enum de estados se declaró completo desde ahora (incluye `RECHAZADO` y
  `SOLUCIONADO`) para no migrar el schema en la Iteración 4, pero esas transiciones todavía no tienen
  acciones que las alcancen. Tests en `backend/tests/criterios.test.js`, mismo patrón que el resto.
- **Iteración 4:** ciclo completo de la máquina de estados — `rechazar` (comentario obligatorio, evidencia
  opcional), `solucionar`, `cerrar_caso` y `reabrir` se suman a `finalizar`/`aprobar` en la misma cadena de
  validación de `aplicarCheck()` (`services/criterio.service.js`). Modelo `reportes` nuevo
  (`models/Reporte.js`) con histórico inmutable por caso — ver `services/reporte.service.js` (`GET
  /criterios/:id/reportes`) y la sección de reglas de negocio más abajo para el ciclo de vida completo del
  caso. Evidencias (imagen/video) vía `multer` (`middleware/upload.middleware.js`) con validación de
  tipo MIME y tamaño por archivo en `utils/evidencias.js`, servidas de vuelta con `GET /uploads/:archivo`
  (`services/evidencia.service.js`) verificando tenant y membresía del proyecto dueño del reporte, nunca
  solo el nombre de archivo. Frontend: modal de rechazo (comentario + carga de evidencias) y drawer lateral
  de histórico con preview de imágenes/video (`pages/ModuloDetallePage.jsx`) — las evidencias se cargan vía
  `apiFetchBlob()` (`api/client.js`) en vez de `<img src>` directo porque un `<img>` no puede mandar el
  header `Authorization`. Tests en `backend/tests/reportes.test.js`, mismo patrón que el resto.
  - Corrección incidental (no parte del alcance de la Iteración 4, encontrada al verificar la UI en
    navegador real): `ProyectoContext` solo cargaba `proyectos` al visitar `/proyectos`; una recarga de
    página o un link directo a `/modulos/:id` dejaba `columnasCheck` vacío en silencio (sin error visible)
    y ninguna acción de criterio aparecía. Corregido cargando `proyectos` una vez por sesión autenticada
    (`useEffect` sobre `autenticado` en `ProyectoContext.jsx`) en vez de depender de que el usuario haya
    pasado antes por `ProyectosPage`.
- Auditoría de Iteración 3+4 (ver historial de conversación): se detectó y corrigió una condición de carrera
  en `aplicarCheck()` — dos transiciones concurrentes sobre el mismo criterio (doble clic, o dos usuarios
  actuando casi al mismo tiempo) podían aplicar ambas, duplicando `Reporte`s para un mismo caso. Corregido
  con un `findOneAndUpdate` atómico que incluye el estado de origen en el filtro (ver "Seguridad: patrones
  obligatorios" más abajo); el frontend además deshabilita los botones de acción del criterio mientras hay
  una request en vuelo (`CriterioRow` en `pages/ModuloDetallePage.jsx`) para no mandar siquiera la segunda
  request en el caso común de un doble clic accidental. Tests de concurrencia agregados a
  `backend/tests/criterios.test.js` y `backend/tests/reportes.test.js`.

- **Iteración 5:** webhooks salientes (`models/Webhook.js`, `services/webhook.service.js`) — CRUD a nivel
  de proyecto (`GET|POST|PUT|DELETE /proyectos/:id/webhooks`, requiere `esAdmin`, mismo patrón que
  equipo/columnas-check en `proyecto.service.js`: `Proyecto.findOne` directo, no `cargarProyectoConAcceso`,
  porque `requireAdmin` ya garantiza el nivel de acceso). Disparo desacoplado en
  `services/webhookDisparo.service.js`: `fetch` nativo con `AbortController` (timeout configurable, default
  10s), 2 reintentos (default 5s/15s, configurables por `WEBHOOK_TIMEOUT_MS`/`WEBHOOK_REINTENTOS_MS` para
  acortarlos en tests), formateo dual (`google_chat` → `cardsV2` mínimo, `generico` → el objeto de contexto
  tal cual, como POST JSON plano). `criterio.service.js#aplicarCheck` dispara el evento correspondiente a
  cada acción (`aprobar`→`criterio_aprobado`, `rechazar`/`reabrir`→`criterio_rechazado`,
  `solucionar`→`caso_solucionado`, `cerrar_caso`→`caso_cerrado`; `finalizar` no dispara nada) SIN esperar la
  entrega (fire-and-forget, ver `notificarEventoCriterio()` en `webhook.service.js`) para no bloquear la
  respuesta al usuario con los reintentos. `POST /proyectos/:id/reportar-prueba` (capacidad
  `aprobar_rechazar`, no `esAdmin`) arma el payload estándar de la sección 7.4 del PRD (incluye el resumen
  automático de CA rechazados por HU con su comentario más reciente) y dispara `prueba_reportada` de la
  misma forma fire-and-forget, devolviendo de inmediato `webhooksNotificados` (cuántos se encolaron, no
  cuántos se confirmaron entregados). Frontend: `ProyectoWebhooksPage.jsx` (CRUD, admin) y
  `ReportarPruebaPage.jsx` (selección de módulo/HU/resultado, visible a cualquier miembro — el backend
  403-ea si el rol no tiene `aprobar_rechazar`, mismo patrón que el resto de la UI). Tests en
  `backend/tests/webhooks.test.js`, con un servidor HTTP real levantado en el propio test (no mocks) para
  verificar la entrega, los reintentos y el formato de payload por proveedor.
  - **Decisiones tomadas en la Iteración 5** (el PRD no las especifica con precisión suficiente): (1) el
    PRD solo da el payload exacto de `prueba_reportada` (sección 7.4); para los 4 eventos de criterio se
    definió un contexto propio y consistente (`evento, proyecto, modulo, historia, criterio, comentario,
    autor, fecha`) siguiendo el mismo estilo de claves. (2) `reabrir` no tiene evento propio en la sección
    7.2 del PRD — reutiliza `criterio_rechazado` porque ambas acciones dejan el criterio en el mismo estado
    y el interesado externo quiere la misma notificación. (3) Eliminar un webhook es borrado físico
    (`deleteOne`), no soft-delete: a diferencia del árbol de contenido, su configuración no tiene una regla
    de histórico que preservar, y el campo `activo` ya cubre "deshabilitar sin borrar" — mezclar ambos
    conceptos haría que un webhook eliminado luciera igual que uno simplemente desactivado.

- **Iteración 6:** `eventosAuditoria` (`models/EventoAuditoria.js`, `services/auditoria.service.js`,
  `GET /auditoria`, requiere `esAdmin`) — log de solo-escritura para las acciones administrativas que el
  PRD nombra explícitamente: (1) un `esAdmin` corrigiendo una columna de criterio sin tener el rol
  asignado (`check_admin:<accion>`, instrumentado en `aplicarCheck()` junto al flag `porAdmin` ya existente
  en `reportes`), (2) cualquier `reabrir` de un CA aprobado (se audita siempre, no solo cuando lo hace un
  admin — reabrir un caso cerrado es sensible en sí mismo), (3) cambios de rol (`rol_creado`/
  `rol_actualizado`/`rol_eliminado` en `rol.service.js`) y de equipo de proyecto (`equipo_actualizado` en
  `proyecto.service.js#actualizarEquipo`). Un `registrar()` fallido nunca tumba la operación de negocio que
  lo originó (mismo principio que el disparo de webhooks, pero acá SÍ se espera con `await` porque es un
  insert local rápido, no una llamada de red). Frontend: `AuditoriaPage.jsx` (tabla simple, admin). Tests en
  `backend/tests/auditoria.test.js`.
  - **Decisión tomada:** `actualizarColumnasCheck` (reasignar qué rol corresponde a cada columna) NO se
    instrumentó en `eventosAuditoria` — el PRD nombra explícitamente "corrección de columna por admin,
    reapertura, cambios de roles/equipo" como los tres casos a cubrir, y `actualizarColumnasCheck` es
    configuración de proyecto, no "cambio de rol" ni "cambio de equipo" en sentido estricto. Se prefirió
    seguir la lista literal del PRD antes que expandir el alcance por inferencia.
- Auditoría de Iteración 6 (ver historial de conversación): se detectó y corrigió un SSRF — cualquier
  admin de tenant podía registrar un webhook apuntando a un host interno (loopback/privado/link-local,
  incluido el endpoint de metadata de credenciales de nube en `169.254.169.254`) y el servidor efectivamente
  le hacía `fetch()`; confirmado con un servidor HTTP real en `127.0.0.1` antes del fix. `validarUrl()` en
  `services/webhook.service.js` ahora resuelve el host por DNS y rechaza esos rangos (ver "Seguridad:
  patrones obligatorios" más abajo) — los tests que necesitan entrega real a un servidor mock local ahora
  insertan el documento `Webhook` directo por el modelo (`crearWebhookDirecto()` en `tests/webhooks.test.js`)
  en vez de pasar por el endpoint de creación, que ya no lo permitiría. También se agregó un guard en
  `rolService.eliminar()` (rechaza si el rol está en uso en `equipo`/`columnasCheck` de algún proyecto, en
  vez de dejar la referencia colgante) y se corrigió un assert tautológico (`|| true`) en
  `tests/auditoria.test.js` que nunca podía fallar.
- **Script de datos semilla** (`backend/src/seed.js`, `npm run seed` en `backend/`): crea un tenant "Demo"
  (slug `demo`) reutilizando `authService.registrarTenant()` (siembra los roles automáticamente), un admin
  y dos usuarios (Dev/QA) agregados al equipo de "Proyecto Demo", que tiene 2 módulos con 1 requerimiento,
  1 HU y 1 CA de ejemplo cada uno. **Idempotente:** si el tenant `demo` ya existe, no hace nada — no hay
  update-or-create, evita duplicar datos o pisar una demo ya en uso al re-ejecutarlo por error.
- **Verificación de cierre del MVP** (PRD sección 12, los 8 criterios de aceptación del propio sistema):
  los ocho están cubiertos por asserts automatizados específicos, re-verificados en verde en esta
  iteración (`npm test`: 107/107) y varios además confirmados manualmente en navegador real durante esta y
  iteraciones anteriores (login/UI real, no solo la API):
  1. Aislamiento cross-tenant — cross-tenant 404 en las 9 suites de recursos (`proyectos`, `modulos`,
     `requerimientos`, `historias`, `criterios`, `reportes`, `webhooks`, `auditoria`, `usuarios`/`roles`).
  2. QA no puede tocar la columna Desarrollo y viceversa (403) — `criterios.test.js`.
  3. Rechazo sin comentario → 400; con comentario → reporte + rojo + dispara `criterio_rechazado` —
     `reportes.test.js` + `webhooks.test.js`, confirmado en navegador en la Iteración 4/5.
  4. Aprobar a la primera cierra el CA sin habilitar "solucionado" — `criterios.test.js`.
  5. "Solucionado" con distintivo ámbar; "cerrar caso" solo `aprobar_rechazar`, deja el CA verde, histórico
     consultable — `reportes.test.js`, distintivo confirmado en navegador en la Iteración 4.
  6. Imagen/video que exceden su máximo → 400 con mensaje claro — `reportes.test.js`.
  7. "Reportar prueba" arma el mensaje con módulo/HU/CA rechazados y dispara `prueba_reportada` (formato
     `cardsV2` para Google Chat) — `webhooks.test.js`, confirmado con un webhook real en la Iteración 5.
  8. Un forastero no ve el proyecto en el selector ni accede a sus rutas (404) — `proyectos.test.js`,
     reconfirmado en navegador real en esta iteración (listado `/proyectos` y acceso directo a la ruta).

## Resumen del producto (ver PRD para el detalle completo)

Plataforma SaaS multitenant para gestionar requerimientos de software: **Proyecto → Módulo → Requerimiento
→ Historia de Usuario → Criterio de Aceptación → Reporte de rechazo**. El diferenciador es la trazabilidad
por criterio de aceptación (checks por responsable, flujo de rechazo con comentario obligatorio y
evidencias, histórico inmutable) y notificaciones salientes vía webhooks (Google Chat de primera clase).

## Principios de diseño técnico (obligatorios, del PRD sección "Principios")

- **Liviano:** un solo backend, una sola base de datos, un solo frontend. Sin Redis, sin colas, sin caché
  distribuida, sin microservicios, sin websockets/tiempo real.
- Arquitectura en capas simple: **rutas → controladores → servicios → modelos**. No introducir
  abstracciones especulativas ni sobre-diseñar para escenarios de la Fase 2 (sección 11 del PRD).
- Buenas prácticas mínimas pero no opcionales: validación de entrada, JWT, autorización por rol/capacidad
  en cada endpoint, índices en MongoDB, manejo de errores consistente, configuración por variables de
  entorno.

## Proceso de calidad

- Antes de reportar cualquier iteración como completa, autoverificar contra
  [`docs/checklist-iteracion.md`](docs/checklist-iteracion.md) y presentar el resultado del checklist
  junto con la entrega (qué se cumple, qué no aplica y por qué, qué queda pendiente).
- Todo endpoint nuevo se entrega en la misma iteración con sus asserts de seguridad: aislamiento de
  tenant, permisos (rol/capacidad correcta e incorrecta, sin token), y validación de tipos de sus campos
  de entrada.
- Tras cada auditoría aprobada (comando `/auditar`), los patrones nuevos que haya identificado se agregan
  al checklist — el checklist crece con cada iteración, nunca queda estático.

## Stack técnico (PRD sección 2)

| Capa | Tecnología |
|---|---|
| Backend | Node.js (LTS) + Express + Mongoose |
| Base de datos | MongoDB, instancia única; multitenancy por `tenantId` en cada documento |
| Frontend | React + Vite, React Router |
| Estilos | Tailwind CSS, sin librerías de componentes pesadas |
| Autenticación | JWT (access token) + bcryptjs |
| Evidencias | Disco local del servidor (`/uploads`), ruta configurable por env var, servidas por Express con validación de acceso por tenant |
| Webhooks salientes | `fetch` nativo, 2 reintentos, sin cola |

Variables de entorno mínimas: `MONGODB_URI`, `JWT_SECRET`, `UPLOADS_PATH`, `PORT`, `MAX_IMAGE_MB=10`,
`MAX_VIDEO_MB=100`. Opcionales (no forman parte del contrato mínimo del PRD, tienen default): `WEBHOOK_TIMEOUT_MS`
(default `10000`) y `WEBHOOK_REINTENTOS_MS` (lista separada por comas, default `5000,15000`) — permiten
acortar el timeout/reintentos de `webhookDisparo.service.js` en tests sin tocar el comportamiento por
defecto en producción.

## Reglas de negocio no obvias (críticas para no romper al implementar)

- **Multitenancy:** todo documento lleva `tenantId` indexado (primer campo del índice compuesto). El
  aislamiento se fuerza en la capa de servicios filtrando siempre por el `tenantId` del JWT — **nunca**
  confiar en un `tenantId` enviado por el cliente.
- **Roles dinámicos por tenant**, no hardcodeados en código. Un rol tiene una o más *capacidades*:
  `gestionar_contenido`, `marcar_finalizado`, `aprobar_rechazar`, `solo_lectura` — la administración del
  tenant NO es una capacidad de rol, se controla con el flag `esAdmin: true` a nivel de usuario. Al crear
  un tenant se siembran roles editables ("Administrador" con las tres primeras capacidades, "Dev", "QA",
  "Lector").
- **Columnas de check por proyecto:** cada proyecto define columnas (ej. "Desarrollo" tipo `finalizado`,
  "QA" tipo `aprobacion`), cada una asociada a un rol. Un usuario solo puede modificar la columna cuya
  asignación de rol coincide con su rol *en ese proyecto* (un usuario puede tener roles distintos en
  proyectos distintos). Un usuario con `esAdmin: true` puede corregir cualquier columna, pero queda
  registrado como acción administrativa en el histórico. Al crear un proyecto, las columnas por defecto
  ("Desarrollo"→`finalizado`, "QA"→`aprobacion`) se asocian automáticamente a los roles semilla "Dev" y
  "QA" del tenant si conservan ese nombre; si ya fueron renombrados, la columna queda con `rolId: null`
  hasta que un admin la reasigne vía `PUT /proyectos/:id/columnas-check`.
- **`gestionar_contenido` (y cualquier otra capacidad de rol) se resuelve SIEMPRE en el contexto de un
  proyecto concreto**, nunca de forma global: un usuario tiene el rol que le asignó el equipo (`equipo:
  [{usuarioId, rolId}]`) de ESE proyecto — el mismo usuario puede tener capacidades distintas en otro
  proyecto. Ver `verificarCapacidadEnProyecto()` en `services/acceso.service.js`. En cambio, crear/editar/
  eliminar un proyecto, gestionar su equipo y sus columnas de check son acciones de nivel tenant y
  requieren `esAdmin: true` (middleware `requireAdmin`), no una capacidad de rol — así se separa
  "administra el tenant/proyecto" de "participa en el contenido de un proyecto donde es miembro".
- **Un usuario fuera del equipo de un proyecto (y sin `esAdmin`) recibe 404 en cualquier ruta de ese
  proyecto o de su contenido** (módulos/requerimientos/historias) — igual que un recurso de otro tenant,
  no se revela su existencia. `esAdmin` siempre puede ver y operar cualquier proyecto del tenant sin
  necesidad de estar en su equipo.
- **Jerarquía de contenido con `proyectoId` denormalizado:** `requerimientos` y `historias` guardan su
  `proyectoId` además de su padre inmediato (`moduloId`/`requerimientoId`). Es deliberado: evita atravesar
  la cadena completa (`modulo → proyecto`, `requerimiento → modulo → proyecto`) solo para resolver acceso
  o contar historias por proyecto — ver el contador de `HU-N` más abajo.
- **Código `HU-N` de historias es correlativo POR PROYECTO** (no por requerimiento) y **nunca se
  reutiliza** aunque se borre (soft-delete) una historia: se calcula con
  `Historia.countDocuments({ tenantId, proyectoId })` **sin** filtrar por `activo`, así el conteo
  histórico total nunca baja. El conteo y la inserción no son atómicos, así que dos creaciones
  concurrentes pueden calcular el mismo código: lo resuelve un índice único
  `{tenantId, proyectoId, codigo}` en `models/Historia.js` que rechaza la segunda inserción con error
  `11000`, y `crear()` en `services/historia.service.js` reintenta con un conteo fresco (hasta 5 veces)
  en vez de dejar el error escalar. Cualquier futuro contador correlativo similar debe replicar este
  patrón, no el de un `countDocuments` + `create` sin protección.
- **Reordenar módulos** (`PUT /proyectos/:id/modulos/reordenar`) recibe el arreglo completo de ids en el
  nuevo orden, no un swap puntual — el backend valida que sea exactamente el mismo conjunto de módulos
  activos del proyecto (ni de más ni de menos) antes de reasignar `orden` secuencialmente. Mismo patrón a
  replicar si otra entidad futura necesita reordenamiento manual.
- **Máquina de estados del criterio de aceptación** (enum estricto, toda transición valida capacidad +
  columna asignada). Completa desde la Iteración 4:

  ```
  PENDIENTE → FINALIZADO_DEV → APROBADO (terminal, camino feliz corto)
                             └→ RECHAZADO (requiere comentario, evidencia opcional)
                                  → SOLUCIONADO → (re-verificación) → cierra caso → APROBADO
                                                                    └→ RECHAZADO (nuevo ciclo)
  APROBADO → (reabrir, solo esAdmin o aprobar_rechazar) → RECHAZADO (nuevo caso)
  ```
  El ciclo Solucionado → Re-verificación **solo existe tras un rechazo**; si se aprueba a la primera, el
  criterio se cierra directamente sin pasos intermedios. Todas las acciones y sus estados origen/destino
  están declaradas en el objeto `ACCIONES` de `services/criterio.service.js` (`finalizar`, `aprobar`,
  `rechazar`, `solucionar`, `cerrar_caso`, `reabrir`), junto con `ACCIONES_POR_TIPO_COLUMNA` (derivado del
  mismo objeto, no duplicado a mano).
- **`POST /criterios/:id/check` valida en este orden estricto** (`aplicarCheck()` en
  `services/criterio.service.js`): (1) la columna existe en `proyecto.columnasCheck`, (2) el `tipo` de esa
  columna corresponde a la `accion` recibida — columna `finalizado` habilita `finalizar`/`solucionar`,
  columna `aprobacion` habilita `aprobar`/`rechazar`/`cerrar_caso`/`reabrir` —, (3) el usuario tiene el rol
  asignado a esa columna en el equipo del proyecto (`esAdmin` lo puentea, pero queda marcado `porAdmin:
  true` en la entrada de reporte que genere esa acción), (4) ese rol tiene la capacidad requerida
  (`marcar_finalizado`/`aprobar_rechazar`), (5) el `estado` actual del criterio coincide con alguno de los
  estados de origen válidos para esa acción (`rechazar` tiene DOS orígenes posibles: `FINALIZADO_DEV` la
  primera vez, `SOLUCIONADO` en un ciclo posterior). Cualquier acción futura debe sumarse a esta misma
  cadena de validación agregando una entrada a `ACCIONES`, no creando una ruta paralela. El paso (5) se
  reclama con un `findOneAndUpdate` atómico (`{ estado: { $in: origenes } }` → `$set` del destino), no con
  un `if` sobre el `criterio` ya cargado en memoria — ver "Seguridad: patrones obligatorios" más abajo.
- **`checks` en el criterio guarda el valor ACTUAL por columna (upsert), no un histórico.** Cada acción
  reemplaza la entrada existente de esa `columnaNombre` en vez de apilar una nueva (por eso, tras varios
  ciclos de rechazo/solución, el valor mostrado en `checks` puede quedar "desactualizado" respecto a
  acciones intermedias — es intencional, refleja solo el último toque de esa columna). El histórico
  inmutable real es la colección `reportes` — no confundir ambos conceptos: `checks` es "estado vigente de
  cada columna", `reportes` es "línea de tiempo de incidencias".
- **Decisiones tomadas en la Iteración 4 para resolver ambigüedades del PRD** (la sección 6 del PRD no
  especifica estos detalles con precisión suficiente para implementar sin definirlos):
  - El PRD declara `entradas[].tipo` con un valor `admin` además de `rechazo|solucion|reapertura|cierre`,
    pero no especifica qué acción generaría una entrada de tipo `admin` por sí sola (`finalizar`/`aprobar`
    — el camino feliz — nunca generan una entrada de reporte, así que no hay dónde adjuntarla). En vez de
    inventar un caso de uso para un quinto tipo de entrada, se optó por un campo `porAdmin: Boolean` en la
    MISMA entrada (`rechazo`/`solucion`/`reapertura`/`cierre`) que ya se genera para esa acción, marcado
    `true` cuando quien la ejecuta es `esAdmin` puenteando el rol asignado a la columna. Esto cubre la
    regla del PRD ("corregir cualquier columna... registrándolo en el histórico como acción
    administrativa") sin forzar un reporte nuevo para acciones que hoy no lo generan. Si en el futuro se
    necesita auditar también los bypass de `finalizar`/`aprobar`, ese es el caso de uso natural para
    `eventosAuditoria` (Iteración 6), pensado como log genérico multi-entidad — no para sobrecargar
    `reportes`.
  - El PRD no especifica a qué estado destino lleva `reabrir` ni si genera un reporte nuevo o continúa el
    anterior. Se definió: `reabrir` solo aplica sobre un criterio `APROBADO`, lo lleva a `RECHAZADO`, y
    **siempre crea un Reporte nuevo** (el caso anterior, si existe, ya está `cerrado` — no se reabre el
    mismo documento) con una única entrada `reapertura`. A partir de ahí sigue el ciclo normal
    (`solucionar` → `cerrar_caso`).
  - `comentario` es **obligatorio solo para `rechazar`** (única acción que el PRD marca explícitamente
    como "OBLIGA comentario"); `solucionar`, `cerrar_caso` y `reabrir` lo aceptan pero no lo exigen.
    Evidencias son opcionales en las cuatro acciones que generan reporte (el PRD solo las menciona para
    rechazo, pero no hay razón funcional para prohibirlas en las demás).
- **Nota de deuda conocida (no bloqueante):** el campo `orden` de módulos/requerimientos/historias/
  criterios se calcula igual que se calculaba `codigo` en historias antes de la Iteración 2 (`findOne().
  sort()` + 1, sin índice único) — dos creaciones concurrentes del mismo padre podrían calcular el mismo
  `orden`. A diferencia de `codigo`, una colisión de `orden` no rompe nada (es solo el criterio de
  ordenamiento visual, recuperable reordenando manualmente), así que no se replicó ahí la protección con
  índice único + reintento. Si se decide que sí importa, replicar el mismo patrón que `codigo` en
  `Historia.js`.
- **Reportes (casos) de rechazo:** un rechazo abre un `Reporte` (`estadoCaso: abierto`); rechazos
  sucesivos sobre el mismo caso (tras un ciclo de `solucionar`) agregan entradas al mismo documento en vez
  de crear uno nuevo — `registrarEntradaReporte()` en `services/criterio.service.js` busca primero un
  reporte del criterio con `estadoCaso` en `abierto`/`solucionado` antes de decidir si continúa ese caso o
  crea uno (solo `reabrir` siempre crea uno nuevo, ver más arriba). El caso se cierra explícitamente con
  `cerrar_caso` al re-aprobar tras una solución (`estadoCaso: cerrado`); un `aprobar` directo (camino
  feliz, sin rechazo previo) nunca genera un `Reporte`.
- **Histórico inmutable:** `GET /criterios/:id/reportes` (`services/reporte.service.js`) devuelve todos
  los reportes del criterio con sus entradas (comentario, evidencias, autor, timestamp, `porAdmin`) y usa
  el mismo `cargarCriterioConAcceso` que el resto de operaciones de criterio — consultable aunque el CA
  esté `APROBADO`/el caso `cerrado`, sin filtrar por estado.
- Reabrir un CA aprobado solo lo puede hacer un usuario con `esAdmin: true` o un rol con `aprobar_rechazar`
  (misma columna/capacidad que `aprobar_rechazar`), y queda registrado en el histórico (entrada tipo
  `reapertura`).
- **Evidencias:** imágenes (png/jpg/webp, máx `MAX_IMAGE_MB`), video (mp4/webm, máx `MAX_VIDEO_MB`),
  múltiples archivos por acción (campo multipart `evidencias`, hasta 10). `middleware/upload.middleware.js`
  (multer) valida el MIME contra la lista permitida y aplica un límite global de tamaño (el mayor de los
  dos máximos); `utils/evidencias.js#validarYMapearEvidencias` valida el máximo específico por tipo
  después de que multer ya escribió a disco, borrando el/los archivo(s) si algo falla. El nombre en disco
  es siempre un UUID generado en servidor (nunca el `originalname` del cliente), bajo
  `UPLOADS_PATH/<tenantId>/`. `GET /uploads/:archivo` (`services/evidencia.service.js`) resuelve el tenant
  SIEMPRE de `auth.tenantId` (nunca de la URL) y además reverifica que el usuario tenga acceso al proyecto
  dueño del reporte que referencia esa evidencia — no alcanza con que el archivo sea del mismo tenant.
- **Webhooks:** CRUD a nivel de proyecto (requiere `esAdmin: true`, ruta `/proyectos/:id/webhooks`);
  proveedor `google_chat` (`cardsV2` mínimo: título + campos clave, sin plantillas complejas) o `generico`
  (POST JSON plano con el contexto tal cual, ver payload estándar en PRD sección 7.4). Envío con timeout de
  10 s y 2 reintentos (5 s y 15 s de espera) vía `services/webhookDisparo.service.js`, **nunca esperado por
  el llamador** (fire-and-forget) para no bloquear la operación del usuario si falla; el resultado de cada
  intento se registra en log (`console.log`/`console.error`), nunca se propaga como error HTTP al usuario.
  Un webhook `activo: false` o no suscrito al evento disparado simplemente no se notifica (filtrado en la
  query, no hay envío "fallido" que loguear en ese caso). `validarUrl()` protege contra SSRF: resuelve el
  host por DNS y rechaza loopback, rangos privados y link-local (incluida metadata de nube) además de
  formato/protocolo — ver "Seguridad: patrones obligatorios" más abajo.
- **"Reportar prueba"** (`POST /proyectos/:id/reportar-prueba`) es una acción manual (no automática)
  disponible para roles con `aprobar_rechazar` (no `esAdmin`): selecciona módulo + HU probadas (validado
  que las HU pertenezcan a ese módulo, no solo al proyecto), resultado `exitosa`/`con_errores`, comentario
  opcional. Arma automáticamente el resumen de CA con estado `RECHAZADO` en esas HU, tomando el comentario
  de la entrada `rechazo` **más reciente** de cada `Reporte` (no el primero) — ver `reportarPrueba()` en
  `services/webhook.service.js`. Dispara `prueba_reportada` a los webhooks suscritos del proyecto y
  devuelve de inmediato el resumen armado más `webhooksNotificados` (cuántos webhooks se encolaron, sin
  esperar confirmación de entrega — mismo motivo fire-and-forget que el resto de los eventos).

## Seguridad: patrones obligatorios (de las auditorías de Iteración 1, 2, 3+4 y 6)

Estos patrones surgieron de auditorías de seguridad dirigidas. La de Iteración 1 (multitenancy + auth)
encontró y corrigió 3 vulnerabilidades críticas; la de Iteración 2 encontró una condición de carrera y la
ausencia total de una suite de pruebas persistida; la de Iteración 3+4 encontró una condición de carrera en
las transiciones de estado del criterio; la de Iteración 6 encontró un SSRF en la URL de webhooks y una
eliminación de rol sin guard de "en uso". Son reglas para **toda** iteración futura, no solo para lo ya
implementado — replicar, no reinventar:

- **Toda URL de destino provista por el cliente que el servidor va a `fetch()` se protege contra SSRF**:
  además de `new URL()` + restricción de protocolo (`http`/`https`), se resuelve el host por DNS
  (`dns.promises.lookup(hostname, { all: true })`) y se rechaza si CUALQUIERA de las direcciones resueltas
  cae en loopback (`127.0.0.0/8`, `::1`), privado (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`),
  link-local (`169.254.0.0/16`, incluye metadata de nube) o el hostname literal `localhost` — un dominio
  público puede resolver a una IP privada, así que mirar el string no alcanza. Ver `validarUrl()` en
  `services/webhook.service.js`. Los tests que necesiten entrega real a un servidor local deben insertar el
  documento directo por el modelo (bypaseando el endpoint de creación), no relajar este guard.
- **Antes de eliminar una entidad de configuración referenciada por id desde otra colección (sin
  integridad referencial nativa de Mongo), verificar que no esté en uso y rechazar con mensaje explícito
  si lo está** — mismo espíritu que la regla de "último admin", generalizada. Ver `rolService.eliminar()`
  (`Proyecto.equipo[].rolId` / `columnasCheck[].rolId`).
- **Toda transición de estado (no solo contadores) se reclama con un `findOneAndUpdate` atómico que incluye
  el/los estado(s) de origen esperados en el filtro** (`{ _id, estado: { $in: origenes } }` → `$set` del
  destino), nunca con un `Modelo.findOne()` + mutación en memoria + `.save()` condicionado por un `if`
  previo — dos requests concurrentes (doble clic, o dos usuarios actuando casi al mismo tiempo) pueden
  pasar ambas ese `if` antes de que cualquiera confirme, aplicando la transición dos veces. Si el
  `findOneAndUpdate` no matchea ningún documento, tratarlo igual que "transición inválida" (mismo status y
  mensaje que el resto de los rechazos de esa validación) — no hace falta un código distinto para
  distinguir "ya estaba mal" de "alguien más lo cambió justo ahora". En el frontend, además, deshabilitar
  el control mientras la request está en vuelo evita mandar la segunda request en el caso común de un
  doble clic accidental — defensa en profundidad, no un sustituto del atomic claim del backend. Ver
  `aplicarCheck()` en `services/criterio.service.js` y `CriterioRow` en `pages/ModuloDetallePage.jsx`.
- **Todo contador correlativo calculado con `countDocuments` + `create` en dos pasos está protegido contra
  condición de carrera** con un índice único compuesto que rechace el duplicado, reintentando ante el
  error `11000` en vez de dejarlo escalar a un 500. Ver el código `HU-N` más abajo y `crear()` en
  `services/historia.service.js`.

- **La autenticación nunca confía en el JWT para autorización.** `middleware/auth.middleware.js` vuelve a
  consultar el usuario en BD en cada request (`Usuario.findById(...).select('tenantId esAdmin activo')`)
  y rechaza con 401 si no existe, está inactivo, o su `tenantId` no coincide con el del token. El payload
  del JWT solo prueba identidad (quién es, en qué tenant se autenticó) — nunca lleva `esAdmin` ni ninguna
  otra capacidad, que siempre se resuelve desde BD. Así, desactivar a alguien o quitarle un permiso surte
  efecto de inmediato, sin esperar a que su token expire.
- **Nunca usar `Boolean(valorDeCliente)` en campos booleanos de entrada** — `Boolean("false")` es `true`
  en JS. Usar `booleanoOpcional(valor, nombreCampo)` de `utils/validacion.js`, que exige `true`/`false`
  estricto y lanza 400 en cualquier otro caso.
- **Ningún valor de cliente entra crudo a un filtro de Mongo.** Un objeto como `{ "$ne": null }` en un
  campo usado en `Modelo.findOne({ campo: valorDeCliente })` se interpreta como operador de consulta, no
  como valor literal. Usar `stringParaFiltro(valor, nombreCampo)` de `utils/validacion.js` antes de usar
  cualquier string de cliente en un filtro.
- **Los `:id` de ruta se validan como ObjectId antes de tocar la BD**, con el middleware
  `validarIdParam()` de `middleware/validateObjectId.js` aplicado en la ruta (no en el controlador), para
  responder 400 en vez de un 500 por `CastError` de Mongoose.
- **JWT siempre firma y verifica con `algorithms: ['HS256']` explícito** (`services/token.service.js`) —
  no depender del comportamiento por defecto de la librería para rechazar `alg:none`.
- **Login siempre ejecuta `bcrypt.compare`, exista o no el usuario/tenant**, contra un hash dummy
  (`DUMMY_HASH` en `services/auth.service.js`) cuando no existen, para que el tiempo de respuesta no
  permita distinguir por timing "no existe" de "password incorrecta".
- **Regla de "último admin":** ninguna operación puede dejar un tenant sin ningún usuario con
  `esAdmin: true` y `activo: true` simultáneamente. Cubre eliminar, desactivar (`activo:false`) y degradar
  (`esAdmin:false`), incluso cuando el admin se apunta a sí mismo. Ver
  `contarAdminsActivosExcluyendo()` en `services/usuario.service.js` — cualquier entidad futura con una
  noción similar de "responsable único" debe replicar este patrón.
- **Validación de formato y longitud en texto de entrada:** `validarEmail()` y `validarLongitudMax()` de
  `utils/validacion.js`, usadas en registro de tenant y CRUD de usuarios/roles.
- **Errores de Mongoose que no son `ApiError` se mapean a 400, no al 500 genérico** (`middleware/
  errorHandler.js`): un `ValidationError` (schema `required`/`maxlength`/`enum` fallido) o un `CastError`
  (ObjectId malformado en un campo que no pasa por `validarIdParam`, ej. un `rolId` dentro de un array)
  responden 400 con mensaje sanitizado en vez de un 500 con status incorrecto. Mismo tratamiento para
  `MulterError` (límite de tamaño/cantidad de archivos excedido en una subida) — se mapea a 400, no 500.
- **Un endpoint que sirve archivos de disco (`GET /uploads/:archivo`) nunca resuelve la ruta con un
  `tenantId` de la URL/body, solo con `auth.tenantId`**, y valida el nombre de archivo contra un patrón
  estricto (`^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$`) antes de tocar el filesystem — el nombre en disco siempre lo
  genera el servidor (UUID), así que cualquier valor que no matchee ese patrón no puede ser un archivo
  real y se rechaza con 400 sin intentar leerlo (evita path traversal). Además reverifica acceso al
  proyecto dueño del recurso que referencia el archivo, no solo el tenant. Ver
  `services/evidencia.service.js`.
- **Cualquier arreglo de ids de cliente que se use en un filtro Mongo se valida elemento por elemento**
  (`stringParaFiltro` en cada iteración), aunque exista una verificación de "mismo conjunto que los ids
  reales" aguas abajo — no asumir que esa verificación por sí sola es suficiente documentación de la
  intención; validar el tipo explícitamente igual. Ver `reordenar()` en `services/modulo.service.js`.

## Modelo de datos (PRD sección 8) y contorno de API (sección 9)

El PRD enumera las colecciones MongoDB esperadas (`tenants`, `usuarios`, `roles`, `proyectos`, `modulos`,
`requerimientos`, `historias`, `criterios`, `reportes`, `webhooks`, `eventosAuditoria`) y el contorno de
endpoints REST bajo prefijo `/api` con autorización por capacidad en cada uno. Consultar esas secciones
directamente en el PRD en vez de duplicarlas aquí — son la referencia autoritativa durante la
implementación.

## Alcance: qué NO construir

Fase 2 (documentada pero explícitamente fuera del MVP): dashboard de métricas, notificaciones in-app/email,
webhooks entrantes/bidireccionales, S3, refresh tokens, invitaciones por email, plantillas/exportación,
campos personalizados por tenant.

No-goals permanentes: page builder visual, caché distribuida, colas, microservicios, tiempo real
(websockets), app móvil.

## Idioma

Toda la UI, mensajes de usuario y datos semilla van en **español**. Nombres de campos en el modelo de datos
del PRD también están en español (`nombre`, `descripcion`, `equipo`, etc.) — mantener esa convención al
implementar modelos/schemas salvo que se decida lo contrario explícitamente.
