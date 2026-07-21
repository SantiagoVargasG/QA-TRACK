# Plataforma Multitenant de Requerimientos y Seguimiento QA

MVP completo (Iteraciones 0 a 6 del plan de implementación). Ver
[`docs/PRD-plataforma-seguimiento-qa.md`](docs/PRD-plataforma-seguimiento-qa.md) para el detalle
funcional completo y [`CLAUDE.md`](CLAUDE.md) para las decisiones técnicas tomadas durante la
implementación.

## Estructura del repositorio

```
backend/    Node.js + Express + Mongoose (API REST)
frontend/   React + Vite + Tailwind CSS
docs/       PRD del producto
```

## Requisitos previos

- Node.js LTS (v20+)
- Una instancia de MongoDB accesible (local o [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), free tier M0 es suficiente)

## Instalación

### Backend

```bash
cd backend
npm install
cp .env.example .env   # completar MONGODB_URI y JWT_SECRET
npm run dev
```

Arranca en `http://localhost:4000`. Verificar con `GET /api/health`.

### Datos semilla (demo)

Para explorar la plataforma con datos de ejemplo sin cargar nada a mano:

```bash
cd backend
npm run seed
```

Crea un tenant demo (organización/slug: `demo`) con:

| Usuario | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `demo12345` |
| Dev | `dev@demo.com` | `demo12345` |
| QA | `qa@demo.com` | `demo12345` |

... y un "Proyecto Demo" con 2 módulos, cada uno con 1 requerimiento, 1 historia de usuario y 1 criterio
de aceptación de ejemplo. El script es idempotente: si el tenant `demo` ya existe, no hace nada (borralo
manualmente de la base si querés datos frescos).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Arranca en `http://localhost:5173`. Las llamadas a `/api/*` se redirigen automáticamente al backend
(proxy configurado en `vite.config.js`), así que no hace falta configurar variables de entorno en el
frontend para desarrollo local.

## Variables de entorno (`backend/.env`)

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | Cadena de conexión a MongoDB |
| `JWT_SECRET` | Secreto para firmar los tokens JWT |
| `UPLOADS_PATH` | Carpeta donde se guardan las evidencias subidas (default `./uploads`) |
| `PORT` | Puerto del backend (default `4000`) |
| `MAX_IMAGE_MB` | Tamaño máximo de imágenes de evidencia en MB (default `10`) |
| `MAX_VIDEO_MB` | Tamaño máximo de video de evidencia en MB (default `100`) |
| `WEBHOOK_TIMEOUT_MS` *(opcional)* | Timeout de cada intento de entrega de webhook en ms (default `10000`) |
| `WEBHOOK_REINTENTOS_MS` *(opcional)* | Esperas entre reintentos de webhook, separadas por coma (default `5000,15000`) |

### Nota sobre MongoDB Atlas en Windows

Si usás una URI `mongodb+srv://` y el backend falla al conectar con errores de DNS
(`querySrv ECONNREFUSED` o similar), es un problema conocido del resolver DNS de Node en ciertas redes
(VPN/DNS corporativo o de ISP) que no soportan las consultas SRV/TXT aunque el resto de la red funcione
normal. Ya está resuelto en `backend/src/config/db.js`, que fuerza el uso de DNS públicos (8.8.8.8 /
1.1.1.1) antes de conectar.
