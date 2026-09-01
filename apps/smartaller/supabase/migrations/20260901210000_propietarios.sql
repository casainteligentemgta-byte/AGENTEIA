-- Fichas de propietario (comprador) del módulo Importación.
-- RLS por taller. Las Server Actions usan service_role + requireTallerAuth.

create table if not exists public.propietarios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  nombre text not null,
  cedula text,
  telefono text,
  email text,
  fecha_nacimiento text,
  direccion text,
  activo boolean not null default true
);

comment on table public.propietarios is
  'Fichas de propietario/comprador. Un expediente se asigna copiando estos datos al vehículo.';

create index if not exists idx_propietarios_taller
  on public.propietarios (taller_id);

create index if not exists idx_propietarios_taller_activo
  on public.propietarios (taller_id, activo);

create index if not exists idx_propietarios_taller_nombre
  on public.propietarios (taller_id, nombre);

create unique index if not exists idx_propietarios_taller_cedula
  on public.propietarios (taller_id, cedula)
  where cedula is not null and btrim(cedula) <> '';

alter table public.propietarios enable row level security;

drop policy if exists "propietarios select own taller" on public.propietarios;
create policy "propietarios select own taller"
  on public.propietarios for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "propietarios insert own taller" on public.propietarios;
create policy "propietarios insert own taller"
  on public.propietarios for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "propietarios update own taller" on public.propietarios;
create policy "propietarios update own taller"
  on public.propietarios for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "propietarios delete own taller" on public.propietarios;
create policy "propietarios delete own taller"
  on public.propietarios for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "propietarios all service role" on public.propietarios;
create policy "propietarios all service role"
  on public.propietarios for all to service_role
  using (true) with check (true);

alter table public.vehiculos
  add column if not exists propietario_id uuid references public.propietarios (id) on delete set null;

comment on column public.vehiculos.propietario_id is
  'Ficha de propietario asignada al expediente.';

create index if not exists idx_vehiculos_propietario
  on public.vehiculos (propietario_id);
