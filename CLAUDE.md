# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Iteraciones 0, 1 y 2 completadas. El PRD en
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
forastero, reutilizado por los tests de proyectos/módulos/requerimientos/historias).

Implementado hasta la Iteración 2:
- **Iteración 0:** esqueleto Express con manejo de errores consistente y `GET /api/health`; conexión a
  MongoDB que falla explícitamente si no logra conectar; frontend con layout base.
- **Iteración 1:** multitenancy, autenticación JWT, roles dinámicos con capacidades, CRUD de
  usuarios/roles con control por `esAdmin`. Endurecida con una auditoría de seguridad dirigida (ver
  sección "Seguridad: patrones obligatorios" más abajo).
- **Iteración 2:** proyectos (con equipo y columnas de check), módulos (con reordenamiento), requerimientos
  e historias de usuario (con código `HU-N` autogenerado). Todo el árbol de contenido usa borrado lógico
  (`activo: Boolean`) y control de acceso por membresía de equipo + capacidad de rol *dentro del
  proyecto* — ver `services/acceso.service.js` (`cargarProyectoConAcceso`, `verificarCapacidadEnProyecto`,
  `cargarModuloConAcceso`, `cargarRequerimientoConAcceso`, `cargarHistoriaConAcceso`), el punto de entrada
  obligatorio para cualquier ruta anidada bajo un proyecto — las cuatro entidades de contenido
  (proyecto/módulo/requerimiento/historia) siguen el mismo patrón sin excepciones.
- Auditoría de Iteración 2 (ver historial de conversación): se detectó y corrigió una condición de carrera
  en el código `HU-N` (dos creaciones concurrentes podían generar el mismo código — ver índice único en
  `models/Historia.js` y el reintento en `crear()` de `services/historia.service.js`), se persistió como
  suite de pruebas (`backend/tests/`) todo lo que hasta entonces se había verificado en arneses temporales
  de auditoría, y se corrigió `historia.service.js` para usar `cargarHistoriaConAcceso` (antes duplicaba
  esa lógica en vez de reutilizar el patrón de `acceso.service.js`).

Cuando se implemente la Iteración 3+ (criterios de aceptación), esta sección debe seguir actualizándose
para reflejar el estado real construido, no el planeado.

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
`MAX_VIDEO_MB=100`.

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
- **Máquina de estados del criterio de aceptación** (implementar como enum estricto, toda transición valida
  capacidad + columna asignada):

  ```
  PENDIENTE → FINALIZADO_DEV → APROBADO (terminal, camino feliz corto)
                             └→ RECHAZADO (requiere comentario, evidencia opcional)
                                  → SOLUCIONADO → (re-verificación) → cierra caso → APROBADO
                                                                    └→ RECHAZADO (nuevo ciclo)
  ```
  El ciclo Solucionado → Re-verificación **solo existe tras un rechazo**; si se aprueba a la primera, el
  criterio se cierra directamente sin pasos intermedios.
- **Reportes (casos) de rechazo:** un rechazo abre un reporte; rechazos sucesivos sobre el mismo caso
  abierto agregan entradas al histórico del mismo caso (no crean uno nuevo). El caso se cierra
  explícitamente con "cerrar caso" al re-aprobar.
- **Histórico inmutable:** reportes, comentarios, evidencias y cambios de estado con autor/timestamp se
  conservan siempre y son consultables aunque el CA esté aprobado/cerrado.
- Reabrir un CA aprobado solo lo puede hacer un usuario con `esAdmin: true` o un rol con `aprobar_rechazar`,
  y queda registrado en histórico.
- **Evidencias:** imágenes (png/jpg/webp, máx 10 MB), video (mp4/webm, máx 100 MB), múltiples archivos por
  reporte, validación de tipo MIME y tamaño en backend (no solo frontend).
- **Webhooks:** CRUD a nivel de proyecto (requiere `esAdmin: true`); proveedor `google_chat` (formato
  cards/texto específico) o `generico` (POST JSON plano, ver payload estándar en PRD sección 7.4). Envío
  con timeout de 10 s y 2 reintentos (5 s y 15 s de espera), sin bloquear la operación del usuario si falla;
  registrar resultado en log.
- **"Reportar prueba"** es una acción manual (no automática) disponible para roles con `aprobar_rechazar`:
  selecciona módulo + HU probadas, resultado exitosa/con-errores, arma automáticamente el resumen de CA
  rechazados en esas HU para el mensaje saliente.

## Seguridad: patrones obligatorios (de las auditorías de Iteración 1 y 2)

Estos patrones surgieron de auditorías de seguridad dirigidas. La de Iteración 1 (multitenancy + auth)
encontró y corrigió 3 vulnerabilidades críticas; la de Iteración 2 encontró una condición de carrera y la
ausencia total de una suite de pruebas persistida. Son reglas para **toda** iteración futura, no solo para
lo ya implementado — replicar, no reinventar:

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
  responden 400 con mensaje sanitizado en vez de un 500 con status incorrecto.
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
