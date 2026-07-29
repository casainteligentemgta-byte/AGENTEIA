# Deploy Vercel — SmartTaller (apps/smartaller)

## Dominio de producción

**https://smarttaller.xyz**

Configura el dominio en Vercel (Settings → Domains) y define en Production:

```
NEXT_PUBLIC_APP_URL=https://smarttaller.xyz
```

## Proyecto Vercel

| Campo | Valor |
|-------|--------|
| Proyecto | `smartaller` (Git conectado a AGENTEIA) |
| Root Directory | **`apps/smartaller`** |
| Framework | Next.js |
| Branch producción | `main` |

Cada **push a `main`** dispara deploy automático en Vercel.

## Variables de entorno (Production)

Obligatorias:

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
OPENAI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL          # https://smarttaller.xyz (sin barra final)
CRON_SECRET
```

Stripe (pagos reales):

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
```

Opcionales: `OPENAI_CHAT_MODEL`, `CALLMEBOT_API_KEY`, `PRESIDENCIA_PIN`, `RESEND_*`

## Supabase (antes del primer deploy)

1. `supabase/deploy-pr9.sql` — plataforma híbrida + seguridad P0
2. `supabase/deploy-stripe.sql` — columnas Stripe en `perfiles`
3. `supabase/verificar-rls.sql` — auditoría RLS

## Webhooks externos

**Telegram:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<TU-DOMINIO>/api/telegram-webhook&secret_token=<SECRET>"
```

**Stripe:** Developers → Webhooks → `https://<TU-DOMINIO>/api/stripe/webhook`  
Eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`

## Deploy manual (CLI)

```bash
cd apps/smartaller
npx vercel deploy --prod --yes
```

## Smoke test post-deploy

- `GET /api/health` → `"status": "ok"`
- `/dashboard` → login taller
- `/app` → paywall o vehículos
- `/vincular CODIGO` en Telegram → foto factura

Guías: `docs/CHECKLIST-LANZAMIENTO.md` · `docs/STRIPE-SETUP.md` · `README.md`
