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
  `admin_tenant`, `gestionar_contenido`, `marcar_finalizado`, `aprobar_rechazar`, `solo_lectura`. Al crear
  un tenant se siembran roles editables ("Administrador", "Dev", "QA", "Lector").
- **Columnas de check por proyecto:** cada proyecto define columnas (ej. "Desarrollo" tipo `finalizado`,
  "QA" tipo `aprobacion`), cada una asociada a un rol. Un usuario solo puede modificar la columna cuya
  asignación de rol coincide con su rol *en ese proyecto* (un usuario puede tener roles distintos en
  proyectos distintos). `admin_tenant` puede corregir cualquier columna, pero queda registrado como acción
  administrativa en el histórico.
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
- Reabrir un CA aprobado solo lo puede hacer `admin_tenant` o un rol con `aprobar_rechazar`, y queda
  registrado en histórico.
- **Evidencias:** imágenes (png/jpg/webp, máx 10 MB), video (mp4/webm, máx 100 MB), múltiples archivos por
  reporte, validación de tipo MIME y tamaño en backend (no solo frontend).
- **Webhooks:** CRUD a nivel de proyecto (capacidad `admin_tenant`); proveedor `google_chat` (formato
  cards/texto específico) o `generico` (POST JSON plano, ver payload estándar en PRD sección 7.4). Envío
  con timeout de 10 s y 2 reintentos (5 s y 15 s de espera), sin bloquear la operación del usuario si falla;
  registrar resultado en log.
- **"Reportar prueba"** es una acción manual (no automática) disponible para roles con `aprobar_rechazar`:
  selecciona módulo + HU probadas, resultado exitosa/con-errores, arma automáticamente el resumen de CA
  rechazados en esas HU para el mensaje saliente.

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
