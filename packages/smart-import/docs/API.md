# API Reference — SmartImport

Base URL: `http://localhost:3000`  
Swagger UI: `/api/docs`  
OpenAPI JSON: `/api/docs.json`

## Auth

Header: `Authorization: Bearer <supabase_jwt>`

Roles: `user` | `admin`  
Tablas ejecutables: `devices` | `automations` | `sensor_data`

## Endpoints

### `GET /health`

Sin auth. 200 healthy/degraded, 503 unhealthy.

### `POST /api/import/analyze`

```json
{ "data": [{ "id": 1, "name": "dev" }] }
```

### `POST /api/import/validate`

```json
{ "data": [{ "id": 1 }] }
```

### `POST /api/import/transform`

```json
{ "data": [{ "name": "A" }], "mapping": { "name": "nombre" } }
```

### `POST /api/import/execute`

```json
{
  "targetTable": "devices",
  "data": [{ "id": 1, "name": "sensor-1" }]
}
```

Límites: máx 10 000 registros/lote · rate limit importaciones (users).

### `GET /api/import/status/:importId`

Dueño del job o `admin`.

### `GET /api/import/admin/users-meta`

Solo `admin`.
