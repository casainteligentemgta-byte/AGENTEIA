-- ========== supabase/migrations/20250705100000_stripe_perfiles.sql ==========

alter table public.perfiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.perfiles.stripe_customer_id is 'Stripe Customer ID (cus_...)';
comment on column public.perfiles.stripe_subscription_id is 'Stripe Subscription ID (sub_...)';

create unique index if not exists idx_perfiles_stripe_customer
  on public.perfiles (stripe_customer_id)
  where stripe_customer_id is not null;
-- ========== supabase/migrations/20250705100000_stripe_perfiles.sql ==========

alter table public.perfiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.perfiles.stripe_customer_id is 'Stripe Customer ID (cus_...)';
comment on column public.perfiles.stripe_subscription_id is 'Stripe Subscription ID (sub_...)';

create unique index if not exists idx_perfiles_stripe_customer
  on public.perfiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_perfiles_stripe_subscription
  on public.perfiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ========== supabase/migrations/20250706100000_mantenimientos_update_categorias.sql ==========

drop policy if exists "mantenimientos update own taller" on public.mantenimientos;
create policy "mantenimientos update own taller"
  on public.mantenimientos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

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

-- ========== supabase/migrations/20250707100000_smartbike.sql ==========

-- Enums
create type public.bike_status as enum ('active', 'stolen', 'sold');
create type public.bike_component_type as enum (
  'cadena',
  'pastillas_freno',
  'neumatico',
  'suspension',
  'rodamientos'
);
create type public.bike_component_status as enum ('green', 'yellow', 'red');

-- Talleres de confianza del ciclista (marca + logo para alertas)
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  logo_url text,
  address text,
  contact_phone text
);

create index if not exists idx_shops_name on public.shops (name);

-- Bicicletas del usuario
create table if not exists public.bikes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete set null,
  brand text not null,
  model text not null,
  frame_serial text not null,
  color text,
  size text,
  material text,
  status public.bike_status not null default 'active',
  strava_gear_id text,
  unique (user_id, frame_serial)
);

create index if not exists idx_bikes_user on public.bikes (user_id);
create index if not exists idx_bikes_strava_gear on public.bikes (strava_gear_id) where strava_gear_id is not null;

-- Componentes con desgaste por kilómetros
create table if not exists public.bike_components (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bike_id uuid not null references public.bikes (id) on delete cascade,
  component_type public.bike_component_type not null,
  brand_model text not null,
  accessory_serial text,
  km_accumulated numeric(10, 2) not null default 0,
  km_limit numeric(10, 2) not null,
  status public.bike_component_status not null default 'green',
  unique (bike_id, component_type)
);

create index if not exists idx_bike_components_bike on public.bike_components (bike_id);
create index if not exists idx_bike_components_status on public.bike_components (status);

-- Protocolo técnico de cierre (taller)
create table if not exists public.maintenance_protocols (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  bike_id uuid not null references public.bikes (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  mechanic_notes text,
  transmission_checked boolean not null default false,
  brakes_checked boolean not null default false,
  bearings_checked boolean not null default false,
  torque_checked boolean not null default false,
  photo_proof_url text
);

create index if not exists idx_maintenance_protocols_bike on public.maintenance_protocols (bike_id);

comment on table public.shops is 'Talleres SmartBike — marca y logo para alertas al ciclista';
comment on table public.bikes is 'Bicicletas registradas por el usuario (Strava + carnet digital)';
comment on table public.bike_components is 'Componentes con km acumulados y semáforo de desgaste';
comment on table public.maintenance_protocols is 'Protocolo obligatorio de cierre del taller';

-- RLS
alter table public.shops enable row level security;
alter table public.bikes enable row level security;
alter table public.bike_components enable row level security;
alter table public.maintenance_protocols enable row level security;

-- Shops: lectura para usuarios autenticados (alertas con logo)
drop policy if exists "shops select authenticated" on public.shops;
create policy "shops select authenticated"
  on public.shops for select to authenticated
  using (true);

-- Bikes: dueño
drop policy if exists "bikes select own" on public.bikes;
create policy "bikes select own"
  on public.bikes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "bikes insert own" on public.bikes;
create policy "bikes insert own"
  on public.bikes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "bikes update own" on public.bikes;
create policy "bikes update own"
  on public.bikes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Componentes: vía bicicleta del usuario
drop policy if exists "bike_components select own" on public.bike_components;
create policy "bike_components select own"
  on public.bike_components for select to authenticated
  using (
    bike_id in (select id from public.bikes where user_id = auth.uid())
  );

drop policy if exists "bike_components insert own" on public.bike_components;
create policy "bike_components insert own"
  on public.bike_components for insert to authenticated
  with check (
    bike_id in (select id from public.bikes where user_id = auth.uid())
  );

drop policy if exists "bike_components update own" on public.bike_components;
create policy "bike_components update own"
  on public.bike_components for update to authenticated
  using (
    bike_id in (select id from public.bikes where user_id = auth.uid())
  )
  with check (
    bike_id in (select id from public.bikes where user_id = auth.uid())
  );

-- Protocolos: lectura dueño de la bici; insert vía service role o taller (skeleton: authenticated con shop)
drop policy if exists "maintenance_protocols select own bike" on public.maintenance_protocols;
create policy "maintenance_protocols select own bike"
  on public.maintenance_protocols for select to authenticated
  using (
    bike_id in (select id from public.bikes where user_id = auth.uid())
  );

drop policy if exists "maintenance_protocols insert authenticated" on public.maintenance_protocols;
create policy "maintenance_protocols insert authenticated"
  on public.maintenance_protocols for insert to authenticated
  with check (true);

-- Panel taller (skeleton): bicis asignadas a un shop
drop policy if exists "bikes select shop assigned" on public.bikes;
create policy "bikes select shop assigned"
  on public.bikes for select to authenticated
  using (shop_id is not null);

drop policy if exists "bike_components select shop bikes" on public.bike_components;
create policy "bike_components select shop bikes"
  on public.bike_components for select to authenticated
  using (
    bike_id in (select id from public.bikes where shop_id is not null)
  );

drop policy if exists "bike_components update shop bikes" on public.bike_components;
create policy "bike_components update shop bikes"
  on public.bike_components for update to authenticated
  using (
    bike_id in (select id from public.bikes where shop_id is not null)
  )
  with check (
    bike_id in (select id from public.bikes where shop_id is not null)
  );

-- Service role acceso total (webhook Strava, scripts)
drop policy if exists "shops all service role" on public.shops;
create policy "shops all service role"
  on public.shops for all to service_role using (true) with check (true);

drop policy if exists "bikes all service role" on public.bikes;
create policy "bikes all service role"
  on public.bikes for all to service_role using (true) with check (true);

drop policy if exists "bike_components all service role" on public.bike_components;
create policy "bike_components all service role"
  on public.bike_components for all to service_role using (true) with check (true);

drop policy if exists "maintenance_protocols all service role" on public.maintenance_protocols;
create policy "maintenance_protocols all service role"
  on public.maintenance_protocols for all to service_role using (true) with check (true);

-- ========== supabase/migrations/20250708100000_diagnostico_media.sql ==========

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diagnosticos',
  'diagnosticos',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Taller: subir a su carpeta {taller_id}/{mantenimiento_id}/*
drop policy if exists "diagnosticos insert taller" on storage.objects;
create policy "diagnosticos insert taller"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'diagnosticos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
    and exists (
      select 1
      from public.mantenimientos m
      where m.id::text = (storage.foldername(name))[2]
        and m.taller_id = public.get_my_taller_id()
    )
  );

-- Taller: leer sus archivos
drop policy if exists "diagnosticos select taller" on storage.objects;
create policy "diagnosticos select taller"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'diagnosticos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

-- Dueño del vehículo: leer diagnósticos de sus mantenimientos
drop policy if exists "diagnosticos select owner vehiculo" on storage.objects;
create policy "diagnosticos select owner vehiculo"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'diagnosticos'
    and exists (
      select 1
      from public.mantenimientos m
      join public.vehiculos v on v.id = m.vehiculo_id
      where m.id::text = (storage.foldername(name))[2]
        and v.user_id = auth.uid()
    )
  );

-- Service role (webhook / scripts)
drop policy if exists "diagnosticos all service role" on storage.objects;
create policy "diagnosticos all service role"
  on storage.objects for all to service_role
  using (bucket_id = 'diagnosticos')
  with check (bucket_id = 'diagnosticos');

comment on table public.mantenimientos is 'Incluye detalle_revision.media[] con URLs de fotos/videos en bucket diagnosticos';

-- ========== supabase/migrations/20250709100000_repuestos.sql ==========

create table if not exists public.repuestos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  nombre text not null,
  sku text,
  unidad text not null default 'und',
  precio_venta numeric(12, 2) not null default 0 check (precio_venta >= 0),
  stock_actual numeric(10, 2) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(10, 2) not null default 0 check (stock_minimo >= 0),
  activo boolean not null default true
);

create index if not exists idx_repuestos_taller on public.repuestos (taller_id);
create index if not exists idx_repuestos_taller_activo on public.repuestos (taller_id, activo);

create table if not exists public.mantenimiento_repuestos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mantenimiento_id uuid not null references public.mantenimientos (id) on delete cascade,
  repuesto_id uuid references public.repuestos (id) on delete set null,
  nombre text not null,
  cantidad numeric(10, 2) not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2) not null default 0 check (precio_unitario >= 0),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0)
);

create index if not exists idx_mantenimiento_repuestos_mant on public.mantenimiento_repuestos (mantenimiento_id);

comment on table public.repuestos is 'Catálogo de repuestos del taller (inventario)';
comment on table public.mantenimiento_repuestos is 'Repuestos consumidos en una orden de servicio';

-- RLS repuestos
alter table public.repuestos enable row level security;

drop policy if exists "repuestos select own taller" on public.repuestos;
create policy "repuestos select own taller"
  on public.repuestos for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos insert own taller" on public.repuestos;
create policy "repuestos insert own taller"
  on public.repuestos for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos update own taller" on public.repuestos;
create policy "repuestos update own taller"
  on public.repuestos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos delete own taller" on public.repuestos;
create policy "repuestos delete own taller"
  on public.repuestos for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos all service role" on public.repuestos;
create policy "repuestos all service role"
  on public.repuestos for all to service_role using (true) with check (true);

-- RLS líneas de repuesto
alter table public.mantenimiento_repuestos enable row level security;

drop policy if exists "mantenimiento_repuestos select taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos select taller"
  on public.mantenimiento_repuestos for select to authenticated
  using (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos select owner vehiculo" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos select owner vehiculo"
  on public.mantenimiento_repuestos for select to authenticated
  using (
    mantenimiento_id in (
      select m.id
      from public.mantenimientos m
      join public.vehiculos v on v.id = m.vehiculo_id
      where v.user_id = auth.uid()
    )
  );

drop policy if exists "mantenimiento_repuestos insert taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos insert taller"
  on public.mantenimiento_repuestos for insert to authenticated
  with check (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos delete taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos delete taller"
  on public.mantenimiento_repuestos for delete to authenticated
  using (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos all service role" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos all service role"
  on public.mantenimiento_repuestos for all to service_role using (true) with check (true);

-- ========== supabase/migrations/20250710100000_smartbike_vehiculo_link.sql ==========

alter table public.bikes
  add column if not exists vehiculo_id uuid references public.vehiculos (id) on delete cascade;

create unique index if not exists idx_bikes_vehiculo_id
  on public.bikes (vehiculo_id)
  where vehiculo_id is not null;

create index if not exists idx_bikes_vehiculo on public.bikes (vehiculo_id);

comment on column public.bikes.vehiculo_id is 'Vehículo SmartTaller vinculado (tipo bicicleta); fuente única en /app/vehiculos';

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
