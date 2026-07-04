-- SmartTaller multivehículo: tipos, perfil de usuario y RLS por propietario.
-- Ejecutar DESPUÉS de 20250704100000_multi_taller.sql

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

-- Vehículos creados por usuarios finales no requieren telegram_chat_id.
alter table public.vehiculos alter column telegram_chat_id drop not null;

-- Índice legacy telegram (multi_taller ya crea idx_vehiculos_placa_taller por taller_id)
create unique index if not exists idx_vehiculos_placa_telegram
  on public.vehiculos (placa, telegram_chat_id)
  where telegram_chat_id is not null;

create unique index if not exists idx_vehiculos_placa_usuario
  on public.vehiculos (placa, user_id)
  where user_id is not null;

create index if not exists idx_vehiculos_user_id on public.vehiculos (user_id);
create index if not exists idx_vehiculos_tipo on public.vehiculos (tipo_vehiculo);

comment on column public.vehiculos.tipo_vehiculo is 'Tipo de vehículo para plantillas de mantenimiento';
comment on column public.vehiculos.user_id is 'Propietario (app usuario final); null = vehículo del taller vía Telegram';

-- RLS app usuario final (coexiste con políticas por taller_id de multi_taller)
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
