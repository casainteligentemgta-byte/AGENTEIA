-- Permite actualizar mantenimientos.detalle_revision (namespace categorias B2C).
-- RLS previo: solo SELECT e INSERT; sin esta migración actualizarCategoriaVehiculo falla en UPDATE.

-- B2B: el taller actualiza sus propios registros
drop policy if exists "mantenimientos update own taller" on public.mantenimientos;
create policy "mantenimientos update own taller"
  on public.mantenimientos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

-- B2C premium: dueño actualiza mantenimientos propios (sin taller_id)
drop policy if exists "mantenimientos update premium b2c" on public.mantenimientos;
create policy "mantenimientos update premium b2c"
  on public.mantenimientos for update to authenticated
  using (
    public.usuario_suscripcion_activa()
    and taller_id is null
    and vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  )
  with check (
    public.usuario_suscripcion_activa()
    and taller_id is null
    and vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );
