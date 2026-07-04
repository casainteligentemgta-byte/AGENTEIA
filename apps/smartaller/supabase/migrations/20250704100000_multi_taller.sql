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
-- (Los talleres se crean al registrarse usuarios; datos huérfanos quedan con taller_id null)

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

-- Vehículos: solo del taller del usuario
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

-- Recordatorios: vía vehículo del taller
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
