-- Políticas RLS adicionales para lectura autenticada en el dashboard.
-- Ejecutar en Supabase SQL Editor si el dashboard no muestra datos tras login.

-- Mantenimientos: lectura para usuarios autenticados
drop policy if exists "Allow read mantenimientos for authenticated" on public.mantenimientos;
create policy "Allow read mantenimientos for authenticated"
  on public.mantenimientos for select
  to authenticated
  using (true);

-- Vehículos
drop policy if exists "Allow read vehiculos for authenticated" on public.vehiculos;
create policy "Allow read vehiculos for authenticated"
  on public.vehiculos for select
  to authenticated
  using (true);

-- Recordatorios
drop policy if exists "Allow read recordatorios for authenticated" on public.recordatorios;
create policy "Allow read recordatorios for authenticated"
  on public.recordatorios for select
  to authenticated
  using (true);
