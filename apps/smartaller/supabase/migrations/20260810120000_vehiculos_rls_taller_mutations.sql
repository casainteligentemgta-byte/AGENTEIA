-- Defensa en profundidad: mutaciones de vehiculos por taller vía cliente autenticado.
-- Hoy las Server Actions de Puerto Libre usan service_role (salta RLS); estas políticas
-- protegen si alguien consulta/muta con el cliente de usuario o se migra fuera del admin.
-- El service_role sigue con acceso total (webhook, admin, NFC público).

-- INSERT: solo en el taller del usuario autenticado
drop policy if exists "vehiculos insert own taller" on public.vehiculos;
create policy "vehiculos insert own taller"
  on public.vehiculos for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

-- UPDATE: filas del taller propio (no puede mover a otro taller)
drop policy if exists "vehiculos update own taller" on public.vehiculos;
create policy "vehiculos update own taller"
  on public.vehiculos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

-- DELETE: solo del taller propio
drop policy if exists "vehiculos delete own taller" on public.vehiculos;
create policy "vehiculos delete own taller"
  on public.vehiculos for delete to authenticated
  using (taller_id = public.get_my_taller_id());

comment on policy "vehiculos insert own taller" on public.vehiculos is
  'RLS taller: insertar vehículos solo con taller_id = get_my_taller_id()';
comment on policy "vehiculos update own taller" on public.vehiculos is
  'RLS taller: actualizar solo vehículos del taller propio';
comment on policy "vehiculos delete own taller" on public.vehiculos is
  'RLS taller: borrar solo vehículos del taller propio';
