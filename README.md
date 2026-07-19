# Plataforma Multitenant de Requerimientos y Seguimiento QA

Ver [`docs/PRD-plataforma-seguimiento-qa.md`](docs/PRD-plataforma-seguimiento-qa.md) para el detalle
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

### Nota sobre MongoDB Atlas en Windows

Si usás una URI `mongodb+srv://` y el backend falla al conectar con errores de DNS
(`querySrv ECONNREFUSED` o similar), es un problema conocido del resolver DNS de Node en ciertas redes
(VPN/DNS corporativo o de ISP) que no soportan las consultas SRV/TXT aunque el resto de la red funcione
normal. Ya está resuelto en `backend/src/config/db.js`, que fuerza el uso de DNS públicos (8.8.8.8 /
1.1.1.1) antes de conectar.
