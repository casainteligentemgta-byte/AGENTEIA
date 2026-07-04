-- Limpieza RLS legacy y recordatorios por vehiculo_id del usuario

-- Eliminar políticas permisivas legacy (multi_taller las reemplaza)
drop policy if exists "Allow authenticated read mantenimientos" on public.mantenimientos;
drop policy if exists "Allow authenticated read vehiculos" on public.vehiculos;
drop policy if exists "Allow authenticated read recordatorios" on public.recordatorios;

-- Recordatorios: lectura directa por vehículo del usuario (más estricto que match por placa)
drop policy if exists "recordatorios select by owner placa" on public.recordatorios;
create policy "recordatorios select by owner vehiculo"
  on public.recordatorios for select
  to authenticated
  using (
    vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );

-- Talleres visibles solo si el usuario tiene mantenimientos en ese vehículo
drop policy if exists "talleres select by serviced placa" on public.talleres;
create policy "talleres select by serviced vehiculo"
  on public.talleres for select
  to authenticated
  using (
    id in (
      select m.taller_id
      from public.mantenimientos m
      where m.taller_id is not null
        and m.vehiculo_id in (
          select id from public.vehiculos where user_id = auth.uid()
        )
    )
  );
