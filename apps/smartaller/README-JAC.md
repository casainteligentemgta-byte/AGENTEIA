# Instancia JAC Taller

Misma app que SmartTaller (`apps/smartaller`), desplegada como **otra instancia**: otro proyecto Vercel, otro proyecto Supabase y otro bot de Telegram. La marca se elige por variable de entorno. No se duplica el código.

Nombre provisional de la app: **JAC Taller** (centralizado en `lib/brand/jac.ts`, fácil de cambiar). El dominio aún no está decidido: sale de `NEXT_PUBLIC_SITE_URL`.

## 1. Variable de marca

| Variable | Valor | Notas |
|----------|-------|--------|
| `NEXT_PUBLIC_BRAND` | `jac` | Obligatorio en esta instancia. Si falta o es otro valor, la app se comporta como SmartTaller. |
| `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio` | **Sin dominio fijo.** Poner el URL público real (Vercel o dominio propio) **sin barra final**. |
| `NEXT_PUBLIC_APP_URL` | igual que Site URL | Usado en emails, Stripe, WhatsApp y Telegram. |
| `NEXT_PUBLIC_JAC_MODELS` | opcional | Lista de modelos separada por comas. Si no se define, se usa la lista provisional de `lib/brand/jac-models.ts`. |

Con `NEXT_PUBLIC_BRAND=smarttaller` (o sin definir) la app debe verse y comportarse **igual que hoy** en https://smarttaller.xyz.

## 2. Proyecto Supabase nuevo

1. Crea un proyecto nuevo (no reutilices el de SmartTaller).
2. En el SQL Editor, aplica las migraciones de `supabase/migrations/` **en orden**, o el script `supabase/setup-completo.sql` si es una instalación limpia. Guía: [README.md](./README.md#supabase).
3. Copia las claves al `.env` / Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` (mismo URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)
4. **Authentication → URL Configuration**
   - **Site URL:** el valor de `NEXT_PUBLIC_SITE_URL` (ej. `https://xxx.vercel.app`)
   - **Redirect URLs:**
     - `{SITE_URL}/auth/callback`
     - `{SITE_URL}/auth/confirm`
     - `{SITE_URL}/**`
5. Confirma que RLS está activo en las tablas de `public` (las migraciones lo activan). No hace falta una migración extra para JAC: marca/modelo e intervalos viven en código.

## 3. Proyecto Vercel nuevo

1. Crea un proyecto Vercel **nuevo** (no el de `smartaller` en producción).
2. Git: mismo repo `AGENTEIA`.
3. **Root Directory:** `apps/smartaller`
4. Framework: Next.js.
5. Variables de entorno (Production + Preview):

```bash
NEXT_PUBLIC_BRAND=jac
NEXT_PUBLIC_SITE_URL=https://TU-DOMINIO
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ADMIN_CHAT_ID=

GEMINI_API_KEY=
# o OPENAI_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

CRON_SECRET=
PRESIDENCIA_PIN=

# Opcional
RESEND_API_KEY=
RESEND_FROM=JAC Taller Alertas <alertas@tu-dominio>
# Lista provisional. Confirmar con Luis.
NEXT_PUBLIC_JAC_MODELS=Tepuy Pro,La Venezolana Pro,Arena Sport,GX7
```

El dominio aún no está decidido: usa el `*.vercel.app` del proyecto hasta registrar el definitivo, y actualiza Site URL / Redirect URLs de Supabase al cambiarlo.

## 4. Bot de Telegram nuevo

1. En [@BotFather](https://t.me/BotFather) crea un bot **nuevo** (no reutilices `@smartTaller_bot`).
2. Copia el token a `TELEGRAM_BOT_TOKEN`.
3. Genera un secreto aleatorio para `TELEGRAM_WEBHOOK_SECRET`.
4. Tras el primer deploy, registra el webhook:

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=${NEXT_PUBLIC_SITE_URL}/api/telegram-webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

5. En el dashboard del taller: Configuración → copiar `/vincular CODIGO` y enviarlo al bot nuevo.

El webhook es `POST /api/telegram-webhook`. Al registrar un vehículo por Telegram en esta instancia, la marca queda fija en **JAC**.

## 5. Stripe

Usa una cuenta / producto **propio de la instancia JAC** (no reutilices webhooks de SmartTaller):

1. Crea el producto (nombre sugerido: `JAC Taller Pro`, $2.99/mes) o reutiliza el mismo precio si Luis lo decide.
2. `STRIPE_PRICE_ID` = `price_...`
3. Webhook a `{SITE_URL}/api/stripe/webhook` (eventos de suscripción, igual que SmartTaller). Ver `docs/STRIPE-SETUP.md`.
4. Añade `STRIPE_WEBHOOK_SECRET`.

## 6. Auth (Supabase)

Además del Site URL / Redirect URLs del paso 2:

- Correos de confirmación y recuperación usan `NEXT_PUBLIC_SITE_URL` (`lib/app-url.ts`).
- Si activas Google OAuth: `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1` y las Redirect URLs del proveedor deben incluir `{SITE_URL}/auth/callback`.
- No copies usuarios ni sesiones del proyecto SmartTaller.

## 7. Qué cambia con `jac`

- Nombre, logos (PNG negro/blanco), favicon, metadata y PWA.
- Tema “app moderna con fotos”: Plus Jakarta Sans, fondo `#f3f4f8`, fotos oficiales de modelos, copy de tú en español venezolano (cauchos, carro).
- Alta de vehículo (dueño, taller y Telegram): marca fija **JAC**; modelo de lista configurable.
- Intervalos de mantenimiento: misma estructura por marca/modelo; valores actuales (5000 km / 6 meses) hasta que JAC entregue los de fábrica (`TODO` en `lib/brand/jac.ts`).

Lista provisional de modelos Venezuela (nombres comerciales + códigos previos; confirmar con Luis): ver `lib/brand/jac-models.ts`.

## 8. Qué falta para desplegar

- [ ] Dominio definitivo y DNS → actualizar `NEXT_PUBLIC_SITE_URL` + Auth Redirect URLs.
- [ ] Confirmar el nombre “JAC Taller”.
- [ ] Confirmar / recortar la lista de modelos Venezuela.
- [ ] Intervalos de fábrica JAC (hoy se reutilizan los de SmartTaller).
- [ ] Proyecto Supabase + migraciones aplicadas.
- [ ] Proyecto Vercel con `NEXT_PUBLIC_BRAND=jac`.
- [ ] Bot de Telegram + webhook.
- [ ] Stripe (producto, price, webhook).
- [ ] Remitente de correo (Resend + DNS) si se usan alertas.
- [ ] PIN de presidencia y `CRON_SECRET`.
