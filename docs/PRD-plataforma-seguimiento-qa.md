# PRD — Plataforma Multitenant de Requerimientos y Seguimiento QA

**Versión:** 1.0 (MVP)
**Audiencia:** Claude Code (agente de desarrollo)
**Idioma del producto:** Español (UI, mensajes, datos semilla)

---

## 1. Visión del producto

Plataforma SaaS multitenant para gestionar requerimientos de software organizados por proyectos y módulos funcionales, donde cada requerimiento se traduce en historias de usuario (HU) con criterios de aceptación (CA). El diferenciador es la **trazabilidad a nivel de criterio de aceptación**: cada CA tiene checks por responsable (ej. Dev marca "finalizado", QA marca "aprobado" o "rechazado"), con flujo de rechazo que exige comentario, permite evidencia (imagen/video), marca visualmente el criterio y mantiene histórico completo de incidencias hasta su cierre. La plataforma notifica resultados de pruebas a chats externos vía webhooks configurables.

### Problema que resuelve
Los equipos hacen seguimiento QA en hojas de cálculo o herramientas genéricas donde el estado de cada criterio de aceptación, quién lo validó, qué se rechazó y por qué, se pierde o queda disperso. Esta plataforma centraliza requerimiento → HU → CA → validación → incidencia → resolución en un solo flujo visual.

### Principios de diseño técnico (obligatorios)
- **Liviano:** sin Redis, sin colas de mensajes, sin caché distribuida, sin microservicios. Un solo backend, una sola base de datos, un solo frontend.
- **Buenas prácticas mínimas:** validación de entrada, autenticación JWT, autorización por rol en cada endpoint, índices en MongoDB, manejo de errores consistente, variables de entorno para configuración.
- **Preparado para crecer, no sobre-diseñado:** arquitectura en capas simple (rutas → controladores → servicios → modelos). Nada de abstracciones especulativas.

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js (LTS) + Express + Mongoose |
| Base de datos | MongoDB (una sola instancia; multitenancy por `tenantId` en cada documento) |
| Frontend | React + Vite, React Router, fetch nativo o axios |
| Estilos | Tailwind CSS (sin librerías de componentes pesadas; componentes propios simples) |
| Autenticación | JWT (access token) + bcryptjs para contraseñas |
| Archivos (evidencias) | Almacenamiento en disco local del servidor (`/uploads`), servidos por Express con validación de acceso por tenant. Ruta configurable por variable de entorno para migrar a S3-compatible en el futuro |
| Webhooks salientes | `fetch` nativo con 2 reintentos simples (sin cola) |

**Variables de entorno mínimas:** `MONGODB_URI`, `JWT_SECRET`, `UPLOADS_PATH`, `PORT`, `MAX_IMAGE_MB=10`, `MAX_VIDEO_MB=100`.

---

## 3. Modelo multitenant

- Un **tenant** representa una organización. Todo documento de datos incluye `tenantId` indexado.
- El aislamiento se garantiza en la capa de servicios: toda consulta filtra por el `tenantId` del token JWT. Nunca confiar en `tenantId` enviado por el cliente.
- Registro inicial: un usuario crea el tenant y se convierte en su primer administrador.

### Jerarquía de datos

```
Tenant
└── Proyecto (1..N) — con equipo asignado
    └── Módulo (1..N) — sección funcional (ej. Catálogo, Pedidos, Clientes)
        └── Requerimiento (1..N) — descripción resumida
            └── Historia de Usuario (1..N)
                └── Criterio de Aceptación (1..N) — con checks por responsable
                    └── Reporte de rechazo (0..N) — histórico, con evidencias
```

---

## 4. Roles y permisos

### 4.1 Roles dinámicos
Los roles NO están predefinidos en código. Cada tenant crea sus roles (ej. "Dev", "QA", "PO", "UAT Cliente") y les asigna **capacidades**:

| Capacidad | Descripción |
|---|---|
| `gestionar_contenido` | Crear/editar módulos, requerimientos, HU y CA |
| `marcar_finalizado` | Puede marcar checks de tipo "finalizado" |
| `aprobar_rechazar` | Puede marcar checks de tipo "aprobado/rechazado" y cerrar casos |
| `solo_lectura` | Ver todo el proyecto sin modificar |

Un rol puede tener varias capacidades. Al crear el tenant se generan como semilla los roles "Administrador" (`gestionar_contenido`, `marcar_finalizado`, `aprobar_rechazar`), "Dev" (`marcar_finalizado`), "QA" (`aprobar_rechazar`) y "Lector" (`solo_lectura`), todos editables.

> **Decisión de diseño:** la administración del tenant (gestionar usuarios, roles, proyectos y webhooks) no es una capacidad de rol — se controla con un flag `esAdmin: true` a nivel de usuario, independiente de los roles que ese usuario tenga en cada proyecto. Esto separa "administra el tenant" de "participa en el flujo QA": un usuario puede ser admin del tenant sin pertenecer a ningún equipo de proyecto, y un miembro de un equipo puede tener capacidades de contenido/flujo sin ser admin. La capacidad `admin_tenant` queda reemplazada por este flag en todo el documento.

### 4.2 Columnas de check asignadas por responsable
Cada criterio de aceptación tiene **columnas de check** definidas a nivel de proyecto (configuración del proyecto, con valores por defecto: columna "Desarrollo" → tipo `finalizado`, columna "QA" → tipo `aprobacion`). Cada columna se asocia a un rol del tenant. **Regla estricta:** un usuario solo puede modificar la columna cuya asignación de rol coincide con su rol en el proyecto. QA no puede tocar la columna de Dev y viceversa. Los usuarios con `esAdmin: true` pueden corregir cualquier columna (registrándolo en el histórico como acción administrativa).

### 4.3 Equipo por proyecto
- Cada proyecto define su equipo: lista de usuarios del tenant con su rol dentro de ese proyecto (un usuario puede ser Dev en un proyecto y QA en otro).
- Solo miembros del equipo (o admins del tenant) ven y operan el proyecto.

---

## 5. Estructura funcional y navegación

### 5.1 Selector de proyecto
- Elemento persistente en la barra superior. Lista los proyectos donde el usuario es miembro.
- Al cambiar de proyecto, toda la vista (módulos, requerimientos) se recarga en su contexto.

### 5.2 Módulos como secciones (estilo sitio, NO page builder)
- Un módulo es una sección configurable del proyecto: **nombre, ícono (set predefinido), descripción corta y orden**.
- Navegación lateral tipo sitio: la barra lateral izquierda lista los módulos del proyecto; al seleccionar uno se muestra su contenido.
- CRUD de módulos disponible para roles con `gestionar_contenido`. Reordenamiento por drag & drop simple o botones subir/bajar (elegir lo más simple de implementar de forma robusta).
- **Fuera de alcance explícito:** edición visual libre de páginas, bloques arrastrables de contenido, temas personalizados.

### 5.3 Vista de módulo: requerimientos, HU y criterios
Dentro de un módulo, el contenido se organiza así (de arriba hacia abajo por cada requerimiento):

1. **Requerimiento:** tarjeta con título y **descripción resumida** (texto corto orientado a dar contexto rápido del proyecto; máx ~500 caracteres, con campo opcional de descripción extendida colapsada).
2. **Historias de usuario del requerimiento:** listadas bajo el requerimiento con formato estándar ("Como [rol], quiero [acción], para [beneficio]") en campo libre de texto.
3. **Criterios de aceptación:** desplegable (accordion) por HU. Al expandir, se listan los CA, cada uno con:
   - Texto del criterio.
   - Las columnas de check del proyecto (ej. Dev | QA) con su estado actual.
   - Indicador visual de estado (ver máquina de estados).
   - Acceso al histórico de reportes del criterio.

---

## 6. Máquina de estados del criterio de aceptación

Estados y transiciones (implementar como enum estricto en backend; toda transición valida capacidad del usuario y columna asignada):

```
PENDIENTE
   │  (rol con marcar_finalizado marca su columna)
   ▼
FINALIZADO_DEV
   │
   ├── (rol con aprobar_rechazar aprueba) ──► APROBADO  ✅ [estado terminal: criterio cerrado]
   │
   └── (rol con aprobar_rechazar rechaza) ──► RECHAZADO 🔴
              │  · el rechazo OBLIGA comentario
              │  · evidencia opcional: imágenes y/o video
              │  · el CA se marca en rojo en la UI
              ▼
        (rol con marcar_finalizado marca "solucionado")
              ▼
        SOLUCIONADO 🟡
              │  · se muestra distintivo visible de "corrección realizada"
              │  · el reporte de rechazo sigue visible hasta el cierre
              ▼
        (rol con aprobar_rechazar re-verifica)
              ├── aprueba ──► "cerrar caso": reporte pasa a CERRADO,
              │               CA pasa a APROBADO y se desmarca el rojo
              └── rechaza de nuevo ──► RECHAZADO (nuevo ciclo, nuevo reporte
                                        en el histórico del mismo caso)
```

**Reglas clave:**
- El camino feliz es corto: `PENDIENTE → FINALIZADO_DEV → APROBADO`. **El ciclo Solucionado → Re-verificación solo existe y se habilita cuando hubo un rechazo.** Si QA aprueba a la primera, el criterio se cierra directamente sin pasos adicionales.
- Un rechazo crea un **Reporte** (caso). Rechazos sucesivos sobre el mismo caso abierto agregan entradas a su histórico. El caso se cierra explícitamente con la acción "cerrar caso" al re-aprobar.
- **Histórico inmutable:** todos los reportes, comentarios, evidencias, cambios de estado, con autor y timestamp, se conservan siempre y son consultables desde el CA (aunque el criterio esté aprobado y cerrado).
- Un CA aprobado puede ser reabierto solo por un usuario con `esAdmin: true` o por un rol con `aprobar_rechazar` (acción "reabrir", registrada en histórico).

### Evidencias
- Imágenes: png, jpg, webp — máx 10 MB por archivo.
- Video: mp4, webm — máx 100 MB por archivo.
- Múltiples archivos por reporte. Validar tipo MIME y tamaño en backend. Vista previa de imágenes inline y reproductor de video en un modal.

---

## 7. Webhooks (notificaciones a chats)

### 7.1 Configuración
- CRUD de webhooks a nivel de proyecto (requiere `esAdmin: true`): nombre, URL destino, proveedor (`google_chat` | `generico`), activo sí/no, y eventos suscritos.
- **Google Chat es el proveedor de primera clase:** formatear el mensaje según el formato de Google Chat (cards/texto). El proveedor `generico` envía un POST JSON plano con el payload estándar para integrar cualquier otro chat o sistema.

### 7.2 Eventos configurables por webhook
- `criterio_aprobado`
- `criterio_rechazado`
- `caso_solucionado`
- `caso_cerrado`
- `prueba_reportada` (ver 7.3)

### 7.3 Reporte manual de prueba realizada
Acción "Reportar prueba" disponible en el proyecto para roles con `aprobar_rechazar`:
1. El usuario selecciona **módulo (sección)** y una o varias **HU probadas**.
2. Marca resultado global: **exitosa** o **con errores**.
3. Comentario opcional.
4. Al enviar, el sistema arma el mensaje con: proyecto, módulo, HU probadas (títulos), resultado, resumen automático de los CA rechazados en esas HU (si los hay, con su comentario más reciente), autor y fecha — de modo que el encargado identifique exactamente qué se probó y qué debe corregir.

### 7.4 Payload genérico estándar (proveedor `generico`)
```json
{
  "evento": "prueba_reportada",
  "proyecto": "Nombre del proyecto",
  "modulo": "Pedidos",
  "historias": ["HU-12: Crear pedido", "HU-13: Anular pedido"],
  "resultado": "con_errores",
  "criterios_rechazados": [
    { "hu": "HU-12", "criterio": "El total recalcula al eliminar ítem", "comentario": "No recalcula con descuentos aplicados" }
  ],
  "comentario": "Probado en staging",
  "autor": "Nombre Apellido",
  "fecha": "2026-07-19T15:30:00Z"
}
```
- Entrega: POST con timeout de 10 s y 2 reintentos (esperas de 5 s y 15 s). Registrar en log el resultado del envío; no bloquear la operación del usuario si el webhook falla.

---

## 8. Modelo de datos (colecciones MongoDB)

Índice compuesto con `tenantId` como primer campo en todas las colecciones de datos.

- **tenants:** nombre, slug, createdAt.
- **usuarios:** tenantId, nombre, email (único por tenant), passwordHash, activo.
- **roles:** tenantId, nombre, capacidades [String], esSemilla (Bool).
- **proyectos:** tenantId, nombre, descripción, columnasCheck [{ nombre, tipo: `finalizado`|`aprobacion`, rolId }], equipo [{ usuarioId, rolId }], activo.
- **modulos:** tenantId, proyectoId, nombre, icono, descripción, orden.
- **requerimientos:** tenantId, moduloId, título, descripcionResumida, descripcionExtendida?, orden, createdBy.
- **historias:** tenantId, requerimientoId, título/código (autogenerado HU-N por proyecto), texto, orden.
- **criterios:** tenantId, historiaId, texto, orden, estado (enum de la máquina de estados), checks [{ columnaNombre, valor, usuarioId, fecha }].
- **reportes:** tenantId, criterioId, estadoCaso (`abierto`|`solucionado`|`cerrado`), entradas [{ tipo: `rechazo`|`solucion`|`reapertura`|`cierre`|`admin`, comentario, evidencias [{ url, tipoMime, tamaño }], usuarioId, fecha }].
- **webhooks:** tenantId, proyectoId, nombre, url, proveedor, eventos [String], activo.
- **eventosAuditoria** (opcional simple): tenantId, entidad, entidadId, acción, usuarioId, fecha, detalle — para trazabilidad de cambios de estado.

---

## 9. API (contorno de endpoints)

Prefijo `/api`. Todos autenticados salvo auth. Autorización por capacidad en cada uno.

- `POST /auth/registro-tenant` · `POST /auth/login`
- `GET|POST|PUT|DELETE /usuarios` · `/roles`
- `GET|POST|PUT|DELETE /proyectos` · `PUT /proyectos/:id/equipo` · `PUT /proyectos/:id/columnas-check`
- `GET|POST|PUT|DELETE /proyectos/:id/modulos` (+ reorden)
- `GET|POST|PUT|DELETE /modulos/:id/requerimientos`
- `GET|POST|PUT|DELETE /requerimientos/:id/historias`
- `GET|POST|PUT|DELETE /historias/:id/criterios`
- `POST /criterios/:id/check` — body: { columna, acción: `finalizar`|`aprobar`|`rechazar`|`solucionar`|`cerrar_caso`|`reabrir`, comentario?, evidencias? (multipart) }. El backend valida transición de estado + rol + columna.
- `GET /criterios/:id/reportes` — histórico completo.
- `GET|POST|PUT|DELETE /proyectos/:id/webhooks` · `POST /proyectos/:id/reportar-prueba`
- `GET /uploads/:archivo` — con verificación de tenant.

---

## 10. UI/UX (lineamientos)

- **Layout:** barra superior (logo, selector de proyecto, usuario) + barra lateral (módulos del proyecto, con enlace de configuración para admins) + área de contenido.
- **Código de color de criterios:** neutro (pendiente), azul (finalizado dev), verde (aprobado), **rojo (rechazado)**, **amarillo/ámbar con distintivo "corrección realizada" (solucionado)**. El distintivo de solucionado permanece visible hasta que se cierra el caso; al cerrar, el criterio queda verde y sin marcas rojas.
- Los checks se presentan como columnas alineadas por criterio (tabla ligera dentro del accordion) para escaneo rápido.
- Rechazar abre un modal: comentario obligatorio + zona de carga de evidencias con vista previa.
- El histórico de un criterio se abre en un panel lateral (drawer) con línea de tiempo de entradas.
- Español en toda la interfaz. Diseño limpio, sin dependencias de UI pesadas.

---

## 11. Alcance

### MVP (implementar ahora)
Todo lo descrito en las secciones 3–10: multitenancy, auth JWT, roles dinámicos con capacidades, proyectos con equipo y columnas de check, módulos como secciones, requerimientos/HU/CA, máquina de estados completa con reportes e histórico, evidencias en disco, webhooks salientes (Google Chat + genérico) y reporte manual de pruebas. Incluir datos semilla de demostración (1 tenant, roles semilla, 1 proyecto con 2 módulos, requerimientos y HU de ejemplo) y un README con instrucciones de instalación y variables de entorno.

### Fase 2 (documentado, NO implementar)
- Dashboard de métricas de calidad: % de CA aprobados a la primera, tasa de rechazo por módulo, tiempos de resolución.
- Notificaciones in-app y por email.
- Webhooks bidireccionales / integraciones entrantes.
- Adjuntos en S3-compatible, refresh tokens, invitaciones por email.
- Plantillas de requerimientos y exportación (PDF/Excel) del estado del proyecto.
- Campos personalizados por tenant en requerimientos y HU.

### No-goals permanentes del MVP
Page builder visual, caché distribuida, colas, microservicios, tiempo real (websockets), app móvil.

---

## 12. Criterios de aceptación del propio sistema (verificación del MVP)

1. Dos tenants no pueden ver ni acceder a datos del otro bajo ninguna ruta (probar con tokens cruzados).
2. Un usuario con rol asignado a la columna "QA" no puede modificar la columna "Desarrollo" y viceversa; el backend rechaza el intento con 403.
3. Un rechazo sin comentario es rechazado por el backend; con comentario crea reporte, marca el CA en rojo y dispara el webhook `criterio_rechazado` si está configurado.
4. El flujo aprobación directa cierra el CA sin habilitar acciones de "solucionado".
5. Tras un rechazo, "solucionado" muestra el distintivo ámbar; "cerrar caso" solo está disponible para el rol de aprobación, deja el CA verde y conserva el histórico consultable.
6. Subir una imagen de 11 MB o un video de 101 MB es rechazado con mensaje claro.
7. "Reportar prueba" con 2 HU y resultado "con errores" envía a Google Chat un mensaje que incluye módulo, HU y los CA rechazados con su comentario.
8. Un usuario fuera del equipo de un proyecto no lo ve en el selector ni accede a sus rutas.
