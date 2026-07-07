-- SmartBike: vincular bikes con vehiculos (tipo bicicleta) — un solo registro por bici en la app.

alter table public.bikes
  add column if not exists vehiculo_id uuid references public.vehiculos (id) on delete cascade;

create unique index if not exists idx_bikes_vehiculo_id
  on public.bikes (vehiculo_id)
  where vehiculo_id is not null;

create index if not exists idx_bikes_vehiculo on public.bikes (vehiculo_id);

comment on column public.bikes.vehiculo_id is 'Vehículo ABCopilot vinculado (tipo bicicleta); fuente única en /app/vehiculos';

-- Backfill: crear vehiculo para bicis huérfanas y enlazar
do $$
declare
  r record;
  v_vehiculo_id uuid;
begin
  for r in
    select b.id as bike_id, b.user_id, b.brand, b.model, b.frame_serial, b.color
    from public.bikes b
    where b.vehiculo_id is null
  loop
    select v.id into v_vehiculo_id
    from public.vehiculos v
    where v.user_id = r.user_id
      and v.placa = r.frame_serial
      and v.tipo_vehiculo = 'bicicleta'
    limit 1;

    if v_vehiculo_id is null then
      insert into public.vehiculos (
        user_id,
        tipo_vehiculo,
        placa,
        marca,
        modelo,
        color,
        unidad_odometro,
        kilometraje_ultimo,
        telegram_chat_id,
        updated_at
      ) values (
        r.user_id,
        'bicicleta',
        r.frame_serial,
        r.brand,
        r.model,
        r.color,
        'km',
        0,
        null,
        now()
      )
      returning id into v_vehiculo_id;
    end if;

    update public.bikes
    set vehiculo_id = v_vehiculo_id
    where id = r.bike_id;
  end loop;
end $$;
