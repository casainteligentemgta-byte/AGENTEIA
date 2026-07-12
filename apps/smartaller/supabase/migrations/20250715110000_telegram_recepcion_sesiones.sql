-- Sesión de recepción iniciada por Telegram (foto frontal ya subida)
create table if not exists public.telegram_recepcion_sesiones (
  token uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculos (id) on delete cascade,
  taller_id uuid not null references public.talleres (id) on delete cascade,
  frontal_url text not null,
  frontal_path text not null,
  placa text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_recepcion_sesiones_vehiculo
  on public.telegram_recepcion_sesiones (vehiculo_id);

comment on table public.telegram_recepcion_sesiones is
  'Enlace Telegram → app con foto frontal ya guardada (service role únicamente)';

alter table public.telegram_recepcion_sesiones enable row level security;
