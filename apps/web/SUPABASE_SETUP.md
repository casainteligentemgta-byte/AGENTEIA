# Configurar Supabase (link y migraciones)

## Error: "Cannot find project ref. Have you run supabase link?"

El CLI necesita que el proyecto local esté vinculado a un proyecto en Supabase.

### Pasos (desde la raíz del repo o desde `apps/web`)

1. **Iniciar sesión en Supabase (si no lo has hecho):**
   ```bash
   npx supabase login
   ```

2. **Si es la primera vez:** desde `apps/web`, crear config de Supabase (genera `supabase/config.toml`):
   ```bash
   cd apps/web
   npx supabase init
   ```

3. **Vincular este directorio a tu proyecto:**
   ```bash
   cd apps/web
   npx supabase link --project-ref TU_PROJECT_REF
   ```
   **Dónde está `TU_PROJECT_REF`:** en el dashboard de Supabase, la URL es:
   `https://supabase.com/dashboard/project/TU_PROJECT_REF`  
   Copia ese ID (ej. `abcdefghijklmnop`).

4. **Aplicar migraciones:**
   ```bash
   npx supabase db push
   ```

---

## Si no quieres usar el CLI: ejecutar SQL a mano

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**.
2. Ejecuta en este orden el contenido de cada archivo en `supabase/migrations/`:
   - `20250209000000_create_agent_profile.sql`
   - `20250209100000_create_agent_missions.sql`
   - `20250209200000_create_agent_memory.sql` (habilita pgvector si no está)
   - `20250209210000_agent_profile_rls.sql`
   - **`20250703160000_missions_rls_by_user.sql`** (D7 — RLS por usuario)

**Atajo:** pega todo `supabase/setup-completo.sql` en instalación limpia, o solo **`supabase/deploy-rls-d7.sql`** si ya tienes las tablas y falta el fix D7.
