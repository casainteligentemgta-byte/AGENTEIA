-- Alinear esquema de mantenimientos en produccion (tabla creada parcial o legacy).

alter table public.mantenimientos add column if not exists placa text;
alter table public.mantenimientos add column if not exists kilometraje integer;
alter table public.mantenimientos add column if not exists descripcion text;
alter table public.mantenimientos add column if not exists descripcion_servicio text;
alter table public.mantenimientos add column if not exists costo numeric(12, 2);
alter table public.mantenimientos add column if not exists nombre_cliente text;
alter table public.mantenimientos add column if not exists telefono_cliente text;
alter table public.mantenimientos add column if not exists detalle_revision jsonb not null default '{}'::jsonb;
alter table public.mantenimientos add column if not exists telegram_chat_id bigint;
alter table public.mantenimientos add column if not exists telegram_message_id bigint;
alter table public.mantenimientos add column if not exists telegram_file_id text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mantenimientos'
      and column_name = 'vehiculo_id'
  ) then
    alter table public.mantenimientos
      add column vehiculo_id uuid references public.vehiculos (id) on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mantenimientos'
      and column_name = 'taller_id'
  ) then
    alter table public.mantenimientos
      add column taller_id uuid references public.talleres (id) on delete cascade;
  end if;
end $$;

-- Copiar km desde detalle_revision si se guardo ahi por compatibilidad
update public.mantenimientos
set kilometraje = (detalle_revision->>'kilometraje')::integer
where kilometraje is null
  and detalle_revision ? 'kilometraje'
  and (detalle_revision->>'kilometraje') ~ '^\d+$';
