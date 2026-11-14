-- 20250704170000_rls_cleanup.sql intentó borrar políticas "Allow authenticated read ...",
-- pero las reales se llaman "Allow read <tabla> for authenticated"
-- (20250702100000 / 20250703100000). Eso dejó SELECT USING (true) en mantenimientos
-- (PostgreSQL hace OR entre políticas SELECT).
-- En el proyecto AGENTEIA ya se eliminó el 2026-11-14 vía apply_migration
-- seguridad_p0_mantenimientos_rls.

drop policy if exists "Allow read mantenimientos for authenticated" on public.mantenimientos;
drop policy if exists "Allow authenticated read mantenimientos" on public.mantenimientos;
drop policy if exists "Allow authenticated read vehiculos" on public.vehiculos;
drop policy if exists "Allow authenticated read recordatorios" on public.recordatorios;
