-- Vehículos, recordatorios y relación con mantenimientos (fidelización proactiva).

create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  placa text not null,
  nombre_cliente text,
  telefono_cliente text,
  kilometraje_ultimo integer,
  -- Identifica el taller vía chat de Telegram del mecánico
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

comment on table public.vehiculos is 'Vehículos registrados por taller (telegram_chat_id)';
comment on table public.recordatorios is 'Próximos servicios programados (+6 meses o +5000 km)';

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
