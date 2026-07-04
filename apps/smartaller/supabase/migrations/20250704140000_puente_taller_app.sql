-- Puente taller ↔ app dueño: lectura de historial por placa vinculada.

drop policy if exists "mantenimientos select by owner placa" on public.mantenimientos;
create policy "mantenimientos select by owner placa"
  on public.mantenimientos for select
  to authenticated
  using (
    placa in (
      select placa from public.vehiculos where user_id = auth.uid()
    )
  );

create or replace function public.usuario_es_dueno_placa_vehiculo(v_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehiculos target
    inner join public.vehiculos owned on owned.placa = target.placa
    where target.id = v_id
      and owned.user_id = auth.uid()
  );
$$;

drop policy if exists "recordatorios select by owner placa" on public.recordatorios;
create policy "recordatorios select by owner placa"
  on public.recordatorios for select
  to authenticated
  using (public.usuario_es_dueno_placa_vehiculo(vehiculo_id));

create or replace function public.count_recordatorios_pendientes_placa(p_placa text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.recordatorios r
  inner join public.vehiculos v on v.id = r.vehiculo_id
  where upper(trim(v.placa)) = upper(trim(p_placa))
    and exists (
      select 1
      from public.vehiculos owned
      where owned.placa = v.placa
        and owned.user_id = auth.uid()
    )
    and r.estado = 'pendiente';
$$;

drop policy if exists "talleres select by serviced placa" on public.talleres;
create policy "talleres select by serviced placa"
  on public.talleres for select
  to authenticated
  using (
    id in (
      select m.taller_id
      from public.mantenimientos m
      where m.taller_id is not null
        and m.placa in (
          select placa from public.vehiculos where user_id = auth.uid()
        )
    )
  );
