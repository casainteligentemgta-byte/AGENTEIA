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

