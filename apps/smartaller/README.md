# SmartTaller

Gestión de mantenimientos para talleres vía Telegram + app multivehículo para dueños.

## Dos experiencias

| Ruta | Usuario | Descripción |
|------|---------|-------------|
| `/dashboard` | Taller / mecánico | Panel: facturas Telegram, flota, recordatorios |
| `/app` | Dueño del vehículo | App móvil-first: mis vehículos, mantenimientos |
| `/cliente` | Cliente | Historial por placa (sin login) |
| `/presidencia/[tallerId]` | Recepción | Kiosk en pantalla; auto-refresh cada 30 s |

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing |
| `/login` | Auth con selector Taller / Dueño |
| `/dashboard/configuracion` | URL del kiosk presidencia + vincular Telegram |
| `/app/vehiculos/nuevo` | Registrar auto, moto, bici, etc. |
| `/app/centros` | Mapa de centros de servicio |
| `/api/telegram-webhook` | Webhook del bot |
| `/api/cron/recordatorios` | Cron recordatorios (WhatsApp + email opcional) |
| `/api/health` | Health check para monitoreo |

## Panel presidencia

1. Entra a **Dashboard → Configuración**
2. Copia la URL `/presidencia/{tallerId}` y ábrela en una tablet o TV
3. Opcional: define `PRESIDENCIA_PIN` en Vercel para proteger el acceso

## Tipos de vehículo

Auto, moto, bicicleta, patinete, tractor, maquinaria pesada y jumbo. Config en `lib/vehicles/templates.ts`.

## Supabase

**Instalación limpia:** ejecuta `supabase/setup-completo.sql` en el SQL Editor.

**Migraciones incrementales (orden):**

1. `20250704100000_multi_taller.sql`
2. `20250704130000_fix_talleres_telegram_nullable.sql`
3. `20250704110000_multivehiculo.sql`
4. `20250704140000_puente_taller_app.sql`
5. `20250704120000_centros_servicio.sql` (opcional)
6. `20250704150000_plataforma_hibrida.sql` — industria B2B, perfiles B2C, paywall y revisiones dinámicas
7. `20250704160000_seguridad_p0.sql` — idempotencia Telegram, RLS por vehiculo_id

## Plataforma híbrida B2B / B2C

- **B2B:** `talleres.tipo_industria` → formulario de revisión en `/dashboard/mantenimientos`
- **B2C:** tabla `perfiles` (`tipo_plan`, `suscripcion_activa`, `vencimiento_plan`)
- **Paywall:** `/app` muestra suscripción $2.99/mes si no hay vehículo vinculado a taller ni plan activo

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
PRESIDENCIA_PIN          # opcional
RESEND_API_KEY           # opcional — email recordatorios
RESEND_FROM              # opcional
# Twilio (pendiente)
# CALLMEBOT_API_KEY (solo pruebas WhatsApp)
```

### Webhook Telegram

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<TU-DOMINIO>/api/telegram-webhook&secret_token=<SECRET>"
```

## PWA

La app `/app` incluye `manifest.json` para instalación en móvil. Icono en `public/icon.svg`.

## Post-MVP (no implementado)

- **Multi-taller por cuenta:** un usuario con varios talleres (hoy 1:1 con `owner_user_id`)
- **Panel admin global:** gestión de todos los talleres / centros de servicio
- **Twilio WhatsApp:** producción masiva (CallMeBot solo pruebas)

## Local

```bash
npm install
npm run dev
```

Puerto: http://localhost:3003
