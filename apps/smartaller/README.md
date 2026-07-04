# SmartTaller

Gestión de mantenimientos para talleres vía Telegram + app multivehículo para dueños.

## Dos experiencias

| Ruta | Usuario | Descripción |
|------|---------|-------------|
| `/dashboard` | Taller / mecánico | Panel: facturas Telegram, flota, recordatorios |
| `/app` | Dueño del vehículo | App móvil-first: mis vehículos, mantenimientos |
| `/cliente` | Cliente | Historial por placa (sin login) |

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing |
| `/login` | Auth taller o dueño |
| `/app/vehiculos/nuevo` | Registrar auto, moto, bici, etc. |
| `/app/centros` | Mapa de centros de servicio |
| `/api/telegram-webhook` | Webhook del bot |
| `/api/cron/recordatorios` | Cron recordatorios (Twilio pendiente) |

## Tipos de vehículo

Auto, moto, bicicleta, patinete, tractor, maquinaria pesada y jumbo. Config en `lib/vehicles/templates.ts`.

## Supabase — migraciones (orden)

1. `20250704100000_multi_taller.sql`
2. `20250704130000_fix_talleres_telegram_nullable.sql`
3. `20250704110000_multivehiculo.sql`
4. `20250704140000_puente_taller_app.sql`
5. `20250704120000_centros_servicio.sql` (opcional)

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
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
CRON_SECRET
# Twilio (pendiente)
# CALLMEBOT_API_KEY (solo pruebas)
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
