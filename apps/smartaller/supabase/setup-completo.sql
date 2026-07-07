-- SmartTaller — Setup completo para Supabase SQL Editor
-- Ejecutar en: Supabase Dashboard → SQL → New query → Pegar todo → Run
-- Instalación limpia: incluye todas las migraciones en orden.
-- NOTA: 20250703100000_auth_rls_policies.sql queda obsoleta (reemplazada por multi_taller).

-- ========== supabase/migrations/20250702100000_create_mantenimientos.sql ==========

-- Mantenimientos registrados desde facturas enviadas por Telegram.
-- Ejecutar en el SQL Editor de Supabase o con: supabase db push

create table if not exists public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  placa text,
  kilometraje integer,
  descripcion_servicio text,
  costo numeric(12, 2),
  telegram_chat_id bigint,
  telegram_message_id bigint,
  telegram_file_id text
);

create index if not exists idx_mantenimientos_placa on public.mantenimientos (placa);
create index if not exists idx_mantenimientos_created_at on public.mantenimientos (created_at desc);

comment on table public.mantenimientos is 'Registros de mantenimiento extraÃ­dos de facturas vÃ­a Telegram + GPT-4o';

alter table public.mantenimientos enable row level security;

-- El webhook usa service_role; estas polÃ­ticas permiten lectura autenticada en el dashboard futuro.
create policy "Allow read mantenimientos for authenticated"
  on public.mantenimientos for select
  to authenticated
  using (true);

create policy "Allow insert mantenimientos for service role"
  on public.mantenimientos for insert
  to service_role
  with check (true);
 
-- ========== supabase/migrations/20250702110000_create_vehiculos_recordatorios.sql ==========

-- VehÃ­culos, recordatorios y relaciÃ³n con mantenimientos (fidelizaciÃ³n proactiva).

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  placa text not null,
  nombre_cliente text,
  telefono_cliente text,
  kilometraje_ultimo integer,
  -- Identifica el taller vÃ­a chat de Telegram del mecÃ¡nico
  telegram_chat_id bigint not null,
  unique (placa, telegram_chat_id)
);

create index if not exists idx_vehiculos_placa on public.vehiculos (placa);
create index if not exists idx_vehiculos_telegram_chat on public.vehiculos (telegram_chat_id);

alter table public.mantenimientos
  add column if not exists vehiculo_id uuid references public.vehiculos (id) on delete set null,
  add column if not exists nombre_cliente text,
  add column if not exists telefono_cliente text,
  add column if not exists descripcion text;

-- Copiar descripcion_servicio existente a descripcion si aplica
update public.mantenimientos
set descripcion = descripcion_servicio
where descripcion is null and descripcion_servicio is not null;

create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vehiculo_id uuid not null references public.vehiculos (id) on delete cascade,
  mantenimiento_id uuid references public.mantenimientos (id) on delete set null,
  fecha_programada date not null,
  kilometraje_objetivo integer,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'completado', 'cancelado'))
);

create index if not exists idx_recordatorios_vehiculo on public.recordatorios (vehiculo_id);
create index if not exists idx_recordatorios_fecha on public.recordatorios (fecha_programada);
create index if not exists idx_recordatorios_estado on public.recordatorios (estado);

comment on table public.vehiculos is 'VehÃ­culos registrados por taller (telegram_chat_id)';
comment on table public.recordatorios is 'PrÃ³ximos servicios programados (+6 meses o +5000 km)';

alter table public.vehiculos enable row level security;
alter table public.recordatorios enable row level security;

create policy "Allow read vehiculos for authenticated"
  on public.vehiculos for select to authenticated using (true);

create policy "Allow all vehiculos for service role"
  on public.vehiculos for all to service_role using (true) with check (true);

create policy "Allow read recordatorios for authenticated"
  on public.recordatorios for select to authenticated using (true);

create policy "Allow all recordatorios for service role"
  on public.recordatorios for all to service_role using (true) with check (true);
 
-- ========== supabase/migrations/20250704100000_multi_taller.sql ==========

-- Multi-taller: cada usuario tiene su taller y solo ve sus datos.

create table if not exists public.talleres (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text not null default 'Mi Taller',
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  telegram_chat_id bigint unique,
  codigo_vinculo text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  unique (owner_user_id)
);

create index if not exists idx_talleres_owner on public.talleres (owner_user_id);
create index if not exists idx_talleres_telegram on public.talleres (telegram_chat_id);
create index if not exists idx_talleres_codigo on public.talleres (codigo_vinculo);

alter table public.vehiculos
  add column if not exists taller_id uuid references public.talleres (id) on delete cascade;

alter table public.mantenimientos
  add column if not exists taller_id uuid references public.talleres (id) on delete cascade;

-- Migrar datos existentes: vincular por telegram_chat_id si hay taller registrado
-- (Los talleres se crean al registrarse usuarios; datos huÃ©rfanos quedan con taller_id null)

alter table public.vehiculos drop constraint if exists vehiculos_placa_telegram_chat_id_key;
create unique index if not exists idx_vehiculos_placa_taller
  on public.vehiculos (placa, taller_id)
  where taller_id is not null;

comment on table public.talleres is 'Talleres registrados; uno por usuario (owner)';

-- Helper RLS: taller del usuario autenticado
create or replace function public.get_my_taller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.talleres where owner_user_id = auth.uid() limit 1;
$$;

alter table public.talleres enable row level security;

drop policy if exists "talleres select own" on public.talleres;
create policy "talleres select own"
  on public.talleres for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "talleres insert own" on public.talleres;
create policy "talleres insert own"
  on public.talleres for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "talleres update own" on public.talleres;
create policy "talleres update own"
  on public.talleres for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "talleres all service role" on public.talleres;
create policy "talleres all service role"
  on public.talleres for all to service_role
  using (true) with check (true);

-- VehÃ­culos: solo del taller del usuario
drop policy if exists "Allow read vehiculos for authenticated" on public.vehiculos;
drop policy if exists "vehiculos select own taller" on public.vehiculos;
create policy "vehiculos select own taller"
  on public.vehiculos for select to authenticated
  using (taller_id = public.get_my_taller_id());

-- Mantenimientos: solo del taller del usuario
drop policy if exists "Allow read mantenimientos for authenticated" on public.mantenimientos;
drop policy if exists "mantenimientos select own taller" on public.mantenimientos;
create policy "mantenimientos select own taller"
  on public.mantenimientos for select to authenticated
  using (taller_id = public.get_my_taller_id());

-- Recordatorios: vÃ­a vehÃ­culo del taller
drop policy if exists "Allow read recordatorios for authenticated" on public.recordatorios;
drop policy if exists "recordatorios select own taller" on public.recordatorios;
create policy "recordatorios select own taller"
  on public.recordatorios for select to authenticated
  using (
    vehiculo_id in (
      select id from public.vehiculos where taller_id = public.get_my_taller_id()
    )
  );

-- Service role mantiene acceso total (webhook)
drop policy if exists "Allow all vehiculos for service role" on public.vehiculos;
create policy "vehiculos all service role"
  on public.vehiculos for all to service_role using (true) with check (true);

drop policy if exists "Allow insert mantenimientos for service role" on public.mantenimientos;
create policy "mantenimientos all service role"
  on public.mantenimientos for all to service_role using (true) with check (true);

drop policy if exists "Allow all recordatorios for service role" on public.recordatorios;
create policy "recordatorios all service role"
  on public.recordatorios for all to service_role using (true) with check (true);
 
-- ========== supabase/migrations/20250704130000_fix_talleres_telegram_nullable.sql ==========

-- Fix: telegram_chat_id debe ser nullable.
-- El taller se crea al iniciar sesiÃ³n; Telegram se vincula despuÃ©s con /vincular CODIGO.

alter table public.talleres
  alter column telegram_chat_id drop not null;
 
-- ========== supabase/migrations/20250704110000_multivehiculo.sql ==========

-- SmartTaller multivehÃ­culo: tipos, perfil de usuario y RLS por propietario.
-- Ejecutar DESPUÃ‰S de 20250704100000_multi_taller.sql

create type public.tipo_vehiculo as enum (
  'auto',
  'moto',
  'bicicleta',
  'patinete',
  'tractor',
  'maquinaria_pesada',
  'jumbo'
);

create type public.unidad_odometro as enum ('km', 'horas');

alter table public.vehiculos
  add column if not exists tipo_vehiculo public.tipo_vehiculo not null default 'auto',
  add column if not exists nick text,
  add column if not exists marca text,
  add column if not exists modelo text,
  add column if not exists color text,
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists horas_motor_ultimo integer,
  add column if not exists unidad_odometro public.unidad_odometro not null default 'km';

-- VehÃ­culos creados por usuarios finales no requieren telegram_chat_id.
alter table public.vehiculos alter column telegram_chat_id drop not null;

-- Ãndice legacy telegram (multi_taller ya crea idx_vehiculos_placa_taller por taller_id)
create unique index if not exists idx_vehiculos_placa_telegram
  on public.vehiculos (placa, telegram_chat_id)
  where telegram_chat_id is not null;

create unique index if not exists idx_vehiculos_placa_usuario
  on public.vehiculos (placa, user_id)
  where user_id is not null;

create index if not exists idx_vehiculos_user_id on public.vehiculos (user_id);
create index if not exists idx_vehiculos_tipo on public.vehiculos (tipo_vehiculo);

comment on column public.vehiculos.tipo_vehiculo is 'Tipo de vehÃ­culo para plantillas de mantenimiento';
comment on column public.vehiculos.user_id is 'Propietario (app usuario final); null = vehÃ­culo del taller vÃ­a Telegram';

-- RLS app usuario final (coexiste con polÃ­ticas por taller_id de multi_taller)
drop policy if exists "vehiculos select own user" on public.vehiculos;
create policy "vehiculos select own user"
  on public.vehiculos for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own vehiculos" on public.vehiculos;
create policy "Users insert own vehiculos"
  on public.vehiculos for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own vehiculos" on public.vehiculos;
create policy "Users update own vehiculos"
  on public.vehiculos for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own vehiculos" on public.vehiculos;
create policy "Users delete own vehiculos"
  on public.vehiculos for delete
  to authenticated
  using (user_id = auth.uid());
 
-- ========== supabase/migrations/20250704140000_puente_taller_app.sql ==========

-- Puente taller â†” app dueÃ±o: lectura de historial por placa vinculada.

drop policy if exists "mantenimientos select by owner placa" on public.mantenimientos;
create policy "mantenimientos select by owner vehiculo"
  on public.mantenimientos for select
  to authenticated
  using (
    vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
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
 
-- ========== supabase/migrations/20250704120000_centros_servicio.sql ==========

-- Centros de servicio y distribuidores (app usuario final).

create table if not exists public.centros_servicio (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nombre text not null,
  direccion text not null,
  ciudad text,
  lat double precision not null,
  lng double precision not null,
  imagen_url text,
  rating_promedio numeric(2, 1) not null default 0 check (rating_promedio >= 0 and rating_promedio <= 5),
  rating_cantidad integer not null default 0 check (rating_cantidad >= 0),
  servicios text[] not null default '{}',
  activo boolean not null default true
);

create index if not exists idx_centros_servicio_activo on public.centros_servicio (activo);
create index if not exists idx_centros_servicio_ciudad on public.centros_servicio (ciudad);

create unique index if not exists idx_centros_servicio_nombre_ciudad
  on public.centros_servicio (nombre, ciudad);

comment on table public.centros_servicio is 'Distribuidores y centros de servicio visibles en /app/centros';
comment on column public.centros_servicio.servicios is 'CÃ³digos: aceite, filtros, escaner, balanceo, neumaticos, bateria, alineacion, limpieza_inyectores';

alter table public.centros_servicio enable row level security;

drop policy if exists "Allow read centros_servicio for authenticated" on public.centros_servicio;
create policy "Allow read centros_servicio for authenticated"
  on public.centros_servicio for select
  to authenticated
  using (activo = true);

drop policy if exists "Allow all centros_servicio for service role" on public.centros_servicio;
create policy "Allow all centros_servicio for service role"
  on public.centros_servicio for all
  to service_role
  using (true)
  with check (true);

-- Datos demo (Porlamar, Isla de Margarita â€” referencia ABCopilot)
insert into public.centros_servicio (
  nombre,
  direccion,
  ciudad,
  lat,
  lng,
  rating_promedio,
  rating_cantidad,
  servicios
)
values
  (
    'BAIC PORLAMAR',
    'Av. Juan Bautista Arismendi, Edif. Oriental Auto Piso 1, Local Chrysler, Sector Los Cocos, Porlamar',
    'Porlamar',
    10.9781,
    -63.8487,
    0,
    0,
    array['aceite', 'filtros', 'escaner', 'limpieza_inyectores']
  ),
  (
    'Cauchos Sora C.A.',
    'Av. 4 de Mayo, Sector El Amparo, Porlamar',
    'Porlamar',
    10.9648,
    -63.8542,
    5,
    6,
    array['balanceo', 'aceite', 'neumaticos', 'bateria', 'alineacion']
  ),
  (
    'Automotores Universal C.A.',
    'Centro comercial, Av. RÃ³mulo Gallegos, Porlamar',
    'Porlamar',
    10.9712,
    -63.8515,
    4.5,
    12,
    array['aceite', 'filtros', 'escaner', 'neumaticos', 'bateria', 'alineacion']
  )
on conflict (nombre, ciudad) do nothing;


-- ========== supabase/migrations/20250704150000_plataforma_hibrida.sql ==========

-- Industria del taller (B2B)
create type public.tipo_industria as enum ('concesionario', 'bicicletas', 'constructora');

alter table public.talleres
  add column if not exists tipo_industria public.tipo_industria not null default 'concesionario';

comment on column public.talleres.tipo_industria is 'Vertical B2B: concesionario, bicicletas o constructora';

-- Activos flexibles en vehículos
create type public.tipo_activo as enum ('carro', 'bici', 'maquinaria');

alter table public.vehiculos
  add column if not exists tipo_activo public.tipo_activo,
  add column if not exists serial_alternativo text,
  add column if not exists horometro_actual integer;

comment on column public.vehiculos.tipo_activo is 'Clasificación simplificada del activo';
comment on column public.vehiculos.serial_alternativo is 'Serial de cuadro, motor u otro identificador alterno';
comment on column public.vehiculos.horometro_actual is 'Horas de motor (constructora / maquinaria)';

-- Backfill tipo_activo desde tipo_vehiculo existente
update public.vehiculos
set tipo_activo = case
  when tipo_vehiculo in ('auto', 'moto', 'jumbo') then 'carro'::public.tipo_activo
  when tipo_vehiculo in ('bicicleta', 'patinete') then 'bici'::public.tipo_activo
  when tipo_vehiculo in ('tractor', 'maquinaria_pesada') then 'maquinaria'::public.tipo_activo
  else 'carro'::public.tipo_activo
end
where tipo_activo is null;

update public.vehiculos
set horometro_actual = horas_motor_ultimo
where horometro_actual is null and horas_motor_ultimo is not null;

-- Perfiles B2C (suscripción dueño independiente)
create type public.tipo_plan as enum ('free', 'premium');

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tipo_plan public.tipo_plan not null default 'free',
  suscripcion_activa boolean not null default false,
  vencimiento_plan timestamptz
);

comment on table public.perfiles is 'Perfil B2C: plan y suscripción del dueño independiente';

alter table public.perfiles enable row level security;

drop policy if exists "perfiles select own" on public.perfiles;
create policy "perfiles select own"
  on public.perfiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "perfiles insert own" on public.perfiles;
create policy "perfiles insert own"
  on public.perfiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "perfiles update own" on public.perfiles;
create policy "perfiles update own"
  on public.perfiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "perfiles all service role" on public.perfiles;
create policy "perfiles all service role"
  on public.perfiles for all to service_role
  using (true) with check (true);

-- Detalle de revisión por industria (dashboard mecánico)
alter table public.mantenimientos
  add column if not exists detalle_revision jsonb not null default '{}'::jsonb;

comment on column public.mantenimientos.detalle_revision is 'Campos dinámicos según tipo_industria del taller';

-- Helpers RLS
create or replace function public.usuario_suscripcion_activa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.suscripcion_activa
        and (p.vencimiento_plan is null or p.vencimiento_plan > now())
      from public.perfiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.usuario_tiene_vehiculo_taller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehiculos v
    where v.user_id = auth.uid()
      and v.taller_id is not null
  );
$$;

-- Vehículos: INSERT independiente solo con suscripción activa (o ya vinculado a taller)
drop policy if exists "Users insert own vehiculos" on public.vehiculos;
create policy "Users insert own vehiculos"
  on public.vehiculos for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      taller_id is not null
      or public.usuario_tiene_vehiculo_taller()
      or public.usuario_suscripcion_activa()
    )
  );

-- Mantenimientos: taller registra revisiones desde dashboard
drop policy if exists "mantenimientos insert own taller" on public.mantenimientos;
create policy "mantenimientos insert own taller"
  on public.mantenimientos for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

-- Mantenimientos: dueño premium registra mantenimiento propio sin taller_id
drop policy if exists "mantenimientos insert premium b2c" on public.mantenimientos;
create policy "mantenimientos insert premium b2c"
  on public.mantenimientos for insert to authenticated
  with check (
    public.usuario_suscripcion_activa()
    and taller_id is null
    and vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );

-- Lectura mantenimientos B2C independientes (sin taller_id)
drop policy if exists "mantenimientos select own b2c" on public.mantenimientos;
create policy "mantenimientos select own b2c"
  on public.mantenimientos for select to authenticated
  using (
    taller_id is null
    and vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );

-- ========== supabase/migrations/20250704160000_seguridad_p0.sql ==========

-- Evitar duplicados en reintentos de webhook Telegram
create unique index if not exists idx_mantenimientos_telegram_msg
  on public.mantenimientos (telegram_chat_id, telegram_message_id)
  where telegram_chat_id is not null and telegram_message_id is not null;

-- Lectura historial: solo mantenimientos del vehículo que posee el usuario (no solo por placa)
drop policy if exists "mantenimientos select by owner placa" on public.mantenimientos;
create policy "mantenimientos select by owner vehiculo"
  on public.mantenimientos for select
  to authenticated
  using (
    vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );

-- ========== supabase/migrations/20250704170000_rls_cleanup.sql ==========

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
