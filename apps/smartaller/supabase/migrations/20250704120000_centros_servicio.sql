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
comment on column public.centros_servicio.servicios is 'Códigos: aceite, filtros, escaner, balanceo, neumaticos, bateria, alineacion, limpieza_inyectores';

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

-- Datos demo (Porlamar, Isla de Margarita — referencia ABCopilot)
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
    'Centro comercial, Av. Rómulo Gallegos, Porlamar',
    'Porlamar',
    10.9712,
    -63.8515,
    4.5,
    12,
    array['aceite', 'filtros', 'escaner', 'neumaticos', 'bateria', 'alineacion']
  )
on conflict (nombre, ciudad) do nothing;
