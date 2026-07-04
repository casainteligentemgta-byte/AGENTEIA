# SmartTaller

Gestión de mantenimientos para talleres vía Telegram y **app multivehículo** para dueños (inspirada en ABCopilot).

## Dos experiencias

| Ruta | Usuario | Descripción |
|------|---------|-------------|
| `/dashboard` | Taller / mecánico | Panel web: facturas Telegram, flota, recordatorios |
| `/app` | Dueño del vehículo | App móvil-first: mis vehículos, mantenimientos por tipo |

## Tipos de vehículo soportados

Auto, moto, bicicleta, patinete eléctrico, tractor, maquinaria pesada y jumbo. Cada tipo define:

- Unidad de odómetro (`km` o `horas`)
- Cantidad de ruedas en la UI
- Módulos de mantenimiento visibles (aceite, neumáticos, cadena, hidráulico, etc.)

Configuración en `lib/vehicles/templates.ts`.

## Migración multivehículo

Ejecutar en Supabase SQL Editor **después** de `20250704100000_multi_taller.sql`:

```
apps/smartaller/supabase/migrations/20250704110000_multivehiculo.sql
```

Añade `tipo_vehiculo`, `user_id`, `marca`, `modelo`, `color`, `nick` y RLS para vehículos del usuario.

## Centros de servicio (`/app/centros`)

Migración:

```
apps/smartaller/supabase/migrations/20250704120000_centros_servicio.sql
```

Mapa OpenStreetMap (Leaflet), listado tipo bottom sheet, distancia por geolocalización, tags de servicios y enlace a Google Maps. Incluye seed de Porlamar.

## Puente taller ↔ app

Migración (después de multivehículo):

```
apps/smartaller/supabase/migrations/20250704130000_puente_taller.sql
```

Vincula vehículos por **placa** entre Telegram y `/app`. El historial del taller aparece en la ficha del dueño.

## Deploy en Vercel

| Setting | Valor |
|---------|--------|
| **Root Directory** | `apps/smartaller` |
| **Framework** | Next.js |

### Environment Variables

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CALLMEBOT_API_KEY   (opcional)
```

### Webhook Telegram

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<TU-DOMINIO>/api/telegram-webhook&secret_token=<SECRET>"
```

## Local

```bash
npm install
npm run dev
```

Puerto: http://localhost:3003
