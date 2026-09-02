# Puerto Libre — Importación

Micro-SaaS independiente para expedientes de importación vehicular (desaduanamiento SENIAT, nacionalización, clientes, carga masiva).

Misma base **Supabase** que SmartTaller (RLS, `vehiculos.importacion`, `importadores`). App Next.js aparte: `apps/importacion`.

## Arranque local

```bash
cd apps/importacion
cp .env.example .env.local
# Rellena las mismas claves Supabase que SmartTaller
npm install
npm run dev
```

Abre http://localhost:3004 → redirige a `/smartimport`.

En producción, la URL pública en el mismo dominio de SmartTaller es:

**https://smarttaller.xyz/smartimport**

`/importacion` y `/puerto-libre` redirigen ahí. Un dominio propio (ej. `smartimport.smarttaller.xyz`) se puede añadir después en Vercel sin cambiar código.

## Deploy en Vercel

`vercel.json` ya desactiva previews de branches `cursor/**` (tope Hobby 100 deploys/día).

1. New Project → este repo.
2. **Root Directory:** `apps/importacion`
3. Framework: Next.js
4. Env vars (las mismas de Supabase que SmartTaller, más las de esta app):

| Variable | Notas |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Mismo proyecto que SmartTaller |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Idem |
| `SUPABASE_URL` | Idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor |
| `NEXT_PUBLIC_APP_URL` | URL de este proyecto (ej. `https://smartimport-xxx.vercel.app`) |
| `OPENAI_API_KEY` o `GEMINI_API_KEY` | OCR |
| `CRON_SECRET` | Cron de alertas |
| `RESEND_API_KEY` / `RESEND_FROM` | Opcional, emails de vencimiento |

5. En **Supabase → Authentication → URL Configuration**:
   - Site URL: la URL de esta app
   - Redirect URLs: `https://TU-DOMINIO/auth/callback`
6. (Opcional) Dominio custom, ej. `puertolibre.xyz` o `importacion.smarttaller.xyz`

## Corte desde SmartTaller

Hasta que exista este deploy, `/smartimport` sigue vivo en SmartTaller.

Cuando la app nueva esté en producción, en el proyecto Vercel de **SmartTaller** añade:

```
IMPORTACION_APP_URL=https://TU-DOMINIO-PL
```

Redeploy SmartTaller. A partir de ahí, `/smartimport` y `/smartimport/*` redirigen a la app nueva (el usuario entra de nuevo: las cookies de auth no se comparten entre dominios).

## Auth y roles

Mismos roles de portal (`master`, `admin`, `aduanera`, `taller`, `concesionario`, `usuario`) y las mismas políticas RLS. No hace falta migración SQL para extraer la app.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Redirige al dashboard |
| `/smartimport/login` | Login propio |
| `/smartimport` | Listado de expedientes |
| `/smartimport/clientes` | Importadores |
| `/smartimport/importaciones/nueva` | Alta |
| `/smartimport/carga-masiva` | Carga masiva |
| `/smartimport/[id]` | Ficha / expediente |
| `/v/[token]` | Sticker NFC público |
| `/api/cron/alertas-vencimiento` | Cron diario |
| `/api/health` | Health check |

Migraciones SQL: `apps/smartaller/supabase/migrations/` (fuente canónica compartida).
