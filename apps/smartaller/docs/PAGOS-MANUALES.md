# Pagos manuales (Pago Móvil)

SmartTaller cobra por **Pago Móvil**. Stripe queda en el código pero inactivo: ya no hay activación demo ni checkout en la UI.

## Planes

| Plan | Quién | Precio |
|------|--------|--------|
| SmartTaller Pro | Dueño independiente (`/app`) | **USD 2.99 / mes** |
| SmartTaller Taller | Taller (`/dashboard`) | **USD 100 / mes** |

Los precios se muestran también en bolívares con la **tasa BCV del día** (tabla `tasas_cambio_bcv` + API `bcv.today`, con fallback a la última tasa guardada).

Datos de cobro (archivo `lib/billing/pago-movil.ts`, no hay tabla pública):

- Banco: Banesco
- Teléfono: 0414-7937270
- Cédula: V-13.848.186

## Cortesía de talleres existentes

La migración `20261128010000_manual_payment_confirmation.sql` deja **activos 30 días** a los talleres que ya existían al aplicarla (`suscripcion_activa = true`, `vencimiento_plan = now() + 30 days`). Así `/dashboard` no se cierra el día del deploy.

Los talleres **creados después** nacen sin plan y deben reportar Pago Móvil.

`plan_suscripcion` ya existía en producción (texto, default `basic`); la migración lo añade de forma idempotente.

## Qué tiene que hacer Luis

1. **No fusionar** este PR hasta revisarlo.
2. Aplicar en el SQL Editor de Supabase (proyecto `quocxyesrdwfyeynegkd`) **solo** la migración:
   - `apps/smartaller/supabase/migrations/20261128010000_manual_payment_confirmation.sql`
3. Confirmar que existe el bucket privado `comprobantes-pago`.
4. Revisar reportes en `/portales/master/pagos` (rol master + `ver_todo`).
5. Aprobar extiende 30 días desde ahora, o desde el vencimiento actual si todavía es válido.
6. Exonerar clientes o talleres desde la misma pantalla si aplica.
7. El cron diario `/api/cron/suscripciones` (08:00 VET / 12:00 UTC) envía recordatorios 7 y 3 días antes. En Vercel el cron queda en `vercel.json`; hace falta `CRON_SECRET` y `TELEGRAM_ADMIN_CHAT_ID` (ya configurado).

Hasta que se aplique la SQL, la app no rompe el dashboard (trata la suscripción de taller como vigente si faltan las columnas).
