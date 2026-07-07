# SQL para ejecutar en tu PC — SmartTaller

Carpeta de scripts listos para pegar en **Supabase → SQL Editor → Run**.

Actualizado: 7 jul 2026 (a partir del `setup-completo.sql` completo).

---

## ¿Qué script uso?

| Situación | Archivo |
|-----------|---------|
| **Base de datos vacía / proyecto nuevo** | `../setup-completo.sql` (raíz `supabase/`) — pega todo de una vez |
| **Ya ejecutaste `setup-completo` antiguo** (solo hasta 4 jul) | `01-parche-migraciones-jul5-a-jul10.sql` |
| **Solo falta Stripe** (tienes plataforma híbrida) | `../deploy-stripe.sql` |
| **Verificar que todo quedó bien** | `02` → `05` en orden |
| **Demo SmartBike** (opcional) | `06-seed-smartbike-opcional.sql` |

---

## Orden recomendado en PC

### Instalación nueva
1. `../setup-completo.sql`
2. `02-verificar-rls.sql`
3. `03-verificar-tablas-nuevas.sql`
4. `04-verificar-bucket-diagnosticos.sql`
5. `05-verificar-indice-telegram.sql`
6. (opcional) `06-seed-smartbike-opcional.sql`

### Solo actualizar base existente (tenías hasta jul 4)
1. `01-parche-migraciones-jul5-a-jul10.sql`
2. Verificaciones `02` → `05`

---

## Resultados esperados

| Script | OK si… |
|--------|--------|
| `02-verificar-rls.sql` | Primera query: **0 filas** |
| `03-verificar-tablas-nuevas.sql` | **6 filas** (repuestos, bikes, etc.) |
| `04-verificar-bucket-diagnosticos.sql` | **1 fila**, `public = false` o `true` según migración |
| `05-verificar-indice-telegram.sql` | **1 fila** `idx_mantenimientos_telegram_msg` |

---

## Después del SQL

1. Variables en Vercel → ver `docs/CHECKLIST-LANZAMIENTO.md`
2. Webhook Telegram + Stripe
3. Smoke test `/api/health`

Nuevos scripts se irán añadiendo aquí con numeración consecutiva.
