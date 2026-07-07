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
| `/app/bicicletas` | BiciCopilot — carnet digital y alertas de desgaste |
| `/dashboard/bicicopilot` | Protocolo de cierre del taller (reset contadores) |
| `/app/centros` | Mapa de centros de servicio |
| `/api/strava/webhook` | Webhook ficticio Strava → km en componentes |
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
8. `20250704170000_rls_cleanup.sql` — limpieza RLS legacy, recordatorios por vehiculo_id
9. `20250706100000_mantenimientos_update_categorias.sql` — RLS UPDATE para escribir `categorias` en B2C/B2B
10. `20250707100000_bicicopilot.sql` — BiciCopilot: shops, bikes, bike_components, maintenance_protocols

**Script único post-PR #9:** `supabase/deploy-pr9.sql` (pegar y ejecutar en SQL Editor si ya tienes las migraciones anteriores).

**ABCopilot B2C (escritura de categorías):** ejecuta también `20250706100000_mantenimientos_update_categorias.sql` si aún no lo hiciste (ver sección [detalle_revision](#detalle_revision-jsonb) más abajo).

## BiciCopilot

Módulo de bicicletas con desgaste por kilómetros (Strava) y alertas con marca del taller de confianza.

| Tabla | Uso |
|-------|-----|
| `shops` | Taller de confianza (nombre + logo para alertas) |
| `bikes` | Bicicletas del usuario (carnet digital) |
| `bike_components` | Componentes con `km_accumulated` / `km_limit` y semáforo |
| `maintenance_protocols` | Protocolo obligatorio de cierre del taller |

**Instalación:** migración `20250707100000_bicicopilot.sql` + seed opcional `supabase/seed-bicicopilot.sql`.

**Webhook Strava (ficticio):**

```bash
curl -X POST https://tu-dominio/api/strava/webhook \
  -H "Content-Type: application/json" \
  -H "x-strava-webhook-secret: $STRAVA_WEBHOOK_SECRET" \
  -d '{"data":{"distance":12500,"bicycle_id":"UUID-BICI"}}'
```

Umbrales de desgaste: amarillo ≥ 80 %, rojo ≥ 95 % (`lib/bicicopilot/component-wear.ts`).

## Plataforma híbrida B2B / B2C

- **B2B:** `talleres.tipo_industria` → formulario de revisión en `/dashboard/mantenimientos`
- **B2C:** tabla `perfiles` (`tipo_plan`, `suscripcion_activa`, `vencimiento_plan`)
- **Paywall:** `/app` muestra suscripción $2.99/mes si no hay vehículo vinculado a taller ni plan activo
- **Stripe:** guía en `docs/STRIPE-SETUP.md` · SQL en `supabase/deploy-stripe.sql`

## `detalle_revision` (jsonb)

Columna en `mantenimientos` (`default '{}'`), creada en `20250704150000_plataforma_hibrida.sql`. Almacena campos dinámicos de revisión. **No hay columna adicional** para el estado B2C por categoría: se usa el mismo jsonb con un namespace `categorias`.

### Contrato del documento

Las claves **B2B legacy** viven en la **raíz** del objeto y **no se mueven ni reemplazan** al escribir categorías B2C. El namespace `categorias` es **aditivo y opcional**.

```jsonc
{
  // B2B legacy en raíz — se conservan tal cual (passthrough)
  "voltaje_bateria": 12.4,
  "kilometraje": 45000,
  // "industria_taller_mecanico": { ... }  // si existe en prod, también se conserva

  // B2C — namespace universal
  "categorias": {
    "bateria": {
      "estado": "bien",           // "bien" | "atencion" | "critico"
      "fecha_revision": "2026-06-01",
      "notas": "12.4 V en taller"
    },
    "neumaticos": { "estado": "atencion", "fecha_revision": "2026-05-15" },
    "aceite":     { "estado": "bien", "fecha_revision": "2026-05-01" },
    "general":    { "estado": "critico", "fecha_revision": "2026-04-20", "notas": "..." }
  }
}
```

### Quién escribe qué

| Origen | Claves en jsonb |
|--------|-----------------|
| B2B `createRevisionMantenimiento` | Raíz según `tipo_industria` (ej. `voltaje_bateria`, `desgaste_cadena`) |
| B2C `actualizarCategoriaVehiculo` | Merge en `categorias.{bateria\|neumaticos\|aceite\|general}` |
| B2C `createMantenimientoB2C` / Telegram | No escribe `detalle_revision` (queda `{}`) |

### Validación (Zod)

Esquema en `lib/schemas/categoria-vehiculo.ts`:

- **Lectura tolerante:** `DetalleRevisionSchema` con `.passthrough()` — solo valida `categorias`; el resto de claves pasa sin cambios.
- **Escritura tipada:** `CategoriaVehiculoSchema` en Server Actions (`estado` obligatorio; `fecha_revision` ISO date opcional; `notas` opcional).

### Server Actions

| Función | Uso |
|---------|-----|
| `actualizarCategoriaVehiculo(mantenimientoId, categoria, data)` | Merge en un mantenimiento existente |
| `actualizarCategoriaVehiculoPorVehiculo(vehiculoId, categoria, data)` | Resuelve el último mant. B2C (`taller_id IS NULL`) o crea uno mínimo `"Estado del vehículo"` |

Ambas usan `createClient()` de servidor (RLS). **No** usar `createAdminClient` aquí.

### Lectura del estado en UI B2C

| Componente | Ruta |
|------------|------|
| `VehicleHealthDashboard` | `/app`, `/app/vehiculos/[id]` |
| `CategoriaVehiculoPanel` | `/app/vehiculos/[id]` (escritura) |
| `AlertasBanner` | `/app`, `/app/timeline` (usa `recordatorios`, no jsonb) |
| Timeline filtrado | `/app/timeline?categoria=bateria` |

Lógica de semáforo: `lib/vehicles/vehicle-health.ts` (prioridad: `categorias` → legacy B2B → recordatorios → heurística por descripción).

### Regla de “mantenimiento activo”

No existe fila única de estado. Al **leer**, cada categoría toma la primera fila del historial (`created_at DESC`) que tenga `categorias.{id}`. Al **escribir** B2C, se actualiza el mantenimiento propio más reciente (`taller_id IS NULL`).

### SQL requerido en Supabase (RLS UPDATE)

Sin esta migración, las Server Actions de categorías fallan al hacer `UPDATE`:

```sql
-- supabase/migrations/20250706100000_mantenimientos_update_categorias.sql

drop policy if exists "mantenimientos update own taller" on public.mantenimientos;
create policy "mantenimientos update own taller"
  on public.mantenimientos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "mantenimientos update premium b2c" on public.mantenimientos;
create policy "mantenimientos update premium b2c"
  on public.mantenimientos for update to authenticated
  using (
    public.usuario_suscripcion_activa()
    and taller_id is null
    and vehiculo_id in (select id from public.vehiculos where user_id = auth.uid())
  )
  with check (
    public.usuario_suscripcion_activa()
    and taller_id is null
    and vehiculo_id in (select id from public.vehiculos where user_id = auth.uid())
  );
```

**Prerrequisito:** funciones `get_my_taller_id()` y `usuario_suscripcion_activa()` (incluidas en `deploy-pr9.sql`).

**Nota:** usuarios con vínculo a taller pero sin suscripción premium ven el panel en UI; RLS solo permite UPDATE con `usuario_suscripcion_activa()` en mantenimientos B2C propios.

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
STRIPE_SECRET_KEY          # sk_test_... o sk_live_...
STRIPE_WEBHOOK_SECRET      # whsec_... del webhook
STRIPE_PRICE_ID            # price_... del producto SmartTaller Pro
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
