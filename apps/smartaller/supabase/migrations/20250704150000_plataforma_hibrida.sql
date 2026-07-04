-- Plataforma híbrida B2B/B2C: industria, activos flexibles, perfiles y RLS premium.

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
