# Configuración Stripe — SmartTaller Pro ($2.99/mes)

Guía paso a paso para activar pagos reales en SmartTaller.

## 1. Migración SQL en Supabase

Ejecuta **`supabase/deploy-stripe.sql`** en el SQL Editor (añade columnas `stripe_customer_id` y `stripe_subscription_id` a `perfiles`).

---

## 2. Crear producto en Stripe Dashboard

1. Entra a [dashboard.stripe.com](https://dashboard.stripe.com)
2. Activa **Modo prueba** (Test mode) para empezar
3. **Product catalog** → **Add product**
   - Nombre: `SmartTaller Pro`
   - Descripción: `Suscripción mensual app dueño B2C`
4. Precio:
   - **Recurring** → **Monthly**
   - Monto: **2.99 USD** (o COP según tu mercado)
5. Guarda y copia el **Price ID** → empieza por `price_...`

---

## 3. API Keys

**Developers → API keys**

| Variable Vercel | Valor |
|-----------------|-------|
| `STRIPE_SECRET_KEY` | **Secret key** (`sk_test_...` en prueba, `sk_live_...` en prod) |

> No hace falta publishable key: el checkout es redirect server-side.

---

## 4. Webhook

**Developers → Webhooks → Add endpoint**

| Campo | Valor |
|-------|-------|
| **URL** | `https://TU-DOMINIO.vercel.app/api/stripe/webhook` |
| **Eventos** | Ver lista abajo |

### Eventos a suscribir

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Tras crear el endpoint, copia el **Signing secret** (`whsec_...`) → variable `STRIPE_WEBHOOK_SECRET`.

---

## 5. Variables en Vercel

Root Directory: **`apps/smartaller`**

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
```

Redeploy después de guardar.

---

## 6. Portal de facturación (cancelar / cambiar tarjeta)

En Stripe Dashboard:

**Settings → Billing → Customer portal** → Activar portal

Opciones recomendadas:
- Permitir **cancelar suscripción**
- Permitir **actualizar método de pago**

Los usuarios con suscripción activa verán **“Gestionar suscripción”** en `/app`.

---

## 7. Probar en modo test

1. Ve a `/app` con usuario **Dueño** (sin taller vinculado)
2. Clic en **Suscribirme ahora** → redirige a Stripe Checkout
3. Tarjeta de prueba: `4242 4242 4242 4242` · fecha futura · CVC cualquiera
4. Tras pagar → vuelves a `/app?subscribed=1`
5. Verifica en Supabase:

```sql
select id, tipo_plan, suscripcion_activa, vencimiento_plan, stripe_customer_id, stripe_subscription_id
from public.perfiles
where suscripcion_activa = true
order by updated_at desc
limit 5;
```

---

## 8. Prueba local con Stripe CLI (opcional)

```bash
stripe login
stripe listen --forward-to localhost:3003/api/stripe/webhook
```

Usa el `whsec_...` que imprime el CLI como `STRIPE_WEBHOOK_SECRET` en `.env.local`.

```bash
stripe trigger checkout.session.completed
```

---

## 9. Pasar a producción

1. Stripe Dashboard → desactiva **Test mode**
2. Crea el mismo producto/precio en **live**
3. Nuevo webhook apuntando a tu dominio prod
4. Actualiza en Vercel:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...` (del endpoint live)
   - `STRIPE_PRICE_ID=price_...` (precio live)
5. Redeploy

---

## Flujo técnico

```
Usuario → Paywall → Checkout Session (Stripe)
       → Pago OK → webhook checkout.session.completed
       → sync perfiles (premium, vencimiento_plan, stripe_*)
       → /app accesible sin paywall
```

Renovaciones y cancelaciones se sincronizan vía `customer.subscription.updated` / `deleted`.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Botón no redirige a Stripe | Revisa `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_APP_URL` en Vercel |
| Pago OK pero sigue paywall | Webhook falló: revisa logs Vercel + signing secret |
| Error 400 en webhook | `STRIPE_WEBHOOK_SECRET` incorrecto o endpoint duplicado |
| “Gestionar suscripción” no aparece | Falta `deploy-stripe.sql` o webhook no guardó `stripe_customer_id` |
