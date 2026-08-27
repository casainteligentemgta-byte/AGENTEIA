# API Reference — SmartImport

Base URL: `http://localhost:3000`  
Swagger UI: `/api/docs`  
OpenAPI JSON: `/api/docs/swagger.json` (o ruta expuesta por `mountSwagger`)

## Auth

Header: `Authorization: Bearer <supabase_jwt>`

Roles: `user` | `admin`  
Tablas ejecutables: `devices` | `automations` | `sensor_data`

## Endpoints

### `GET /health`

Sin auth.

**Response** (200):

```json
{
  "status": "healthy",
  "services": { "database": "up", "redis": "up", "memory": "1%", "disk": "16%" }
}
```

503 si `unhealthy`.

### `GET /health/liveness`

**Response:** `{ "alive": true, "uptime": 123 }` — HTTP 200.

### `GET /health/readiness`

**Response:** `{ "ready": true, "status": "healthy" }` — HTTP 200 si listo.

### `GET /metrics`

Prometheus text exposition. Sin auth en local.

### `POST /api/import/analyze`

```json
{ "data": [{ "id": 1, "name": "dev" }] }
```

**Response:** resumen de columnas / tipos detectados.

### `POST /api/import/validate`

```json
{ "data": [{ "id": 1 }] }
```

**Response:** `{ "success": true, "errors": [] }` o lista de errores de validación.

### `POST /api/import/transform`

```json
{ "data": [{ "name": "A" }], "mapping": { "name": "nombre" } }
```

**Response:** registros transformados según `mapping`.

### `POST /api/import/execute`

```json
{
  "targetTable": "devices",
  "data": [{ "id": 1, "name": "sensor-1" }]
}
```

Límites: máx 10 000 registros/lote · rate limit de importaciones (users).

**Response:**

```json
{
  "success": true,
  "importId": "uuid",
  "imported": 1,
  "failed": 0
}
```

### `GET /api/import/status/:importId`

Dueño del job o `admin`.

**Response:** estado del job (`pending` | `running` | `completed` | `failed`).

### `GET /api/import/admin/users-meta`

Solo `admin`.

**Response:** metadatos de uso por usuario.
