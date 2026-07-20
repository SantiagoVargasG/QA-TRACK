# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Iteración 0 completada: existe un esqueleto funcional de backend y frontend, sin lógica de dominio
todavía (eso arranca en la Iteración 1). El PRD en
[`docs/PRD-plataforma-seguimiento-qa.md`](docs/PRD-plataforma-seguimiento-qa.md) sigue siendo la
**fuente de verdad** del producto a construir — léelo completo antes de tocar código de dominio.

Estructura actual:
- `backend/` — Node.js + Express + Mongoose. Capas en `src/{routes,controllers,services,models,middleware,config}`;
  `controllers/`, `services/` y `models/` existen como carpetas vacías, listas para la Iteración 1 (no
  crear código especulativo dentro de ellas hasta que haya lógica real que lo justifique).
- `frontend/` — React + Vite + React Router + Tailwind CSS v4 (plugin `@tailwindcss/vite`).
- `docs/` — PRD del producto.

Comandos para levantar cada parte:
```
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:4000
cd frontend && npm install && npm run dev                          # http://localhost:5173 (proxy /api -> backend)
```

Implementado hasta la Iteración 0 (ver `backend/src/`):
- Esqueleto Express con manejo de errores consistente (`ApiError`, `notFoundHandler`, `errorHandler` en
  `middleware/errorHandler.js`) y `GET /api/health`.
- Conexión a MongoDB (`config/db.js`) que **falla explícitamente** si no logra conectar: `server.js` hace
  `await connectDB()` antes de `app.listen()`, así que si Mongo no responde el proceso loguea el error y
  termina con `process.exit(1)` en vez de arrancar el servidor sin base de datos.
- Frontend con layout base (barra superior + sidebar vacíos) que verifica conectividad contra
  `/api/health` en tiempo real.

Cuando se implemente lógica de dominio (Iteraciones 1+), esta sección debe seguir actualizándose para
reflejar el estado real construido, no el planeado.

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
  registrado como acción administrativa en el histórico.
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

## Seguridad: patrones obligatorios (de la auditoría de Iteración 1)

Estos patrones surgieron de una auditoría de seguridad dirigida sobre la Iteración 1 (multitenancy +
auth) que encontró y corrigió 3 vulnerabilidades críticas. Son reglas para **toda** iteración futura, no
solo para lo ya implementado — replicar, no reinventar:

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
