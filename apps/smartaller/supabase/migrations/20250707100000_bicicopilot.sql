-- BiciCopilot: bicicletas, componentes, talleres y protocolos de mantenimiento.

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

comment on table public.shops is 'Talleres BiciCopilot — marca y logo para alertas al ciclista';
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
