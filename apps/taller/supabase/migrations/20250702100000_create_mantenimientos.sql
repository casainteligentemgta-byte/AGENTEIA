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

comment on table public.mantenimientos is 'Registros de mantenimiento extraídos de facturas vía Telegram + GPT-4o';

alter table public.mantenimientos enable row level security;

-- El webhook usa service_role; estas políticas permiten lectura autenticada en el dashboard futuro.
create policy "Allow read mantenimientos for authenticated"
  on public.mantenimientos for select
  to authenticated
  using (true);

create policy "Allow insert mantenimientos for service role"
  on public.mantenimientos for insert
  to service_role
  with check (true);
