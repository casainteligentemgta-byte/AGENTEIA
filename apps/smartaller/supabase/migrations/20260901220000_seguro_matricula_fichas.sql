-- Fichas de seguro y matrícula (enlace a expediente). RLS por taller.

create table if not exists public.seguros_ficha (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  aseguradora text not null,
  numero_poliza text,
  tipo_cobertura text,
  vigencia_desde text,
  vigencia_hasta text,
  monto_asegurado numeric,
  telefono_aseguradora text,
  corredor text,
  observaciones text,
  activo boolean not null default true
);

comment on table public.seguros_ficha is
  'Fichas de seguro. Al asignar se copian al JSON seguro del vehículo.';

create index if not exists idx_seguros_ficha_taller
  on public.seguros_ficha (taller_id);

alter table public.seguros_ficha enable row level security;

drop policy if exists "seguros_ficha select own taller" on public.seguros_ficha;
create policy "seguros_ficha select own taller"
  on public.seguros_ficha for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "seguros_ficha insert own taller" on public.seguros_ficha;
create policy "seguros_ficha insert own taller"
  on public.seguros_ficha for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "seguros_ficha update own taller" on public.seguros_ficha;
create policy "seguros_ficha update own taller"
  on public.seguros_ficha for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "seguros_ficha delete own taller" on public.seguros_ficha;
create policy "seguros_ficha delete own taller"
  on public.seguros_ficha for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "seguros_ficha all service role" on public.seguros_ficha;
create policy "seguros_ficha all service role"
  on public.seguros_ficha for all to service_role
  using (true) with check (true);

create table if not exists public.matriculas_ficha (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  placa text,
  oficina_intt text,
  fecha_tramite text,
  requiere_homologacion boolean not null default false,
  observaciones text,
  activo boolean not null default true
);

comment on table public.matriculas_ficha is
  'Fichas de matrícula INTT. Al asignar se copian placa y homologación al expediente.';

create index if not exists idx_matriculas_ficha_taller
  on public.matriculas_ficha (taller_id);

alter table public.matriculas_ficha enable row level security;

drop policy if exists "matriculas_ficha select own taller" on public.matriculas_ficha;
create policy "matriculas_ficha select own taller"
  on public.matriculas_ficha for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "matriculas_ficha insert own taller" on public.matriculas_ficha;
create policy "matriculas_ficha insert own taller"
  on public.matriculas_ficha for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "matriculas_ficha update own taller" on public.matriculas_ficha;
create policy "matriculas_ficha update own taller"
  on public.matriculas_ficha for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "matriculas_ficha delete own taller" on public.matriculas_ficha;
create policy "matriculas_ficha delete own taller"
  on public.matriculas_ficha for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "matriculas_ficha all service role" on public.matriculas_ficha;
create policy "matriculas_ficha all service role"
  on public.matriculas_ficha for all to service_role
  using (true) with check (true);

alter table public.vehiculos
  add column if not exists seguro_ficha_id uuid references public.seguros_ficha (id) on delete set null;

alter table public.vehiculos
  add column if not exists matricula_ficha_id uuid references public.matriculas_ficha (id) on delete set null;

create index if not exists idx_vehiculos_seguro_ficha
  on public.vehiculos (seguro_ficha_id);

create index if not exists idx_vehiculos_matricula_ficha
  on public.vehiculos (matricula_ficha_id);
