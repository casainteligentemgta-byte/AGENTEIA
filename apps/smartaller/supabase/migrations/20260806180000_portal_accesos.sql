-- Portales por rol: Master, Aduanera, Taller, Concesionario, Usuario.
-- Master solo ve todo si ver_todo = true (habilitación explícita / cumplimiento).

create table if not exists public.portal_accesos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Roles activos del usuario (puede tener varios).
  roles text[] not null default '{}'::text[],
  -- Si true, el rol master puede listar todos los talleres/vehículos.
  ver_todo boolean not null default false,
  -- Alcance opcional (talleres concretos). Vacío + ver_todo=false = solo su taller propio.
  taller_ids uuid[] not null default '{}'::uuid[],
  org_nombre text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_accesos_roles_valid check (
    roles <@ array['master', 'aduanera', 'taller', 'concesionario', 'usuario']::text[]
  )
);

comment on table public.portal_accesos is
  'Acceso a portales SmartTaller. Master con ver_todo solo si la ley/contrato lo permite.';

comment on column public.portal_accesos.ver_todo is
  'Habilita visión global para master/aduanera. Default false (principio de minimización).';

alter table public.portal_accesos enable row level security;

drop policy if exists "portal_accesos select own" on public.portal_accesos;
create policy "portal_accesos select own"
  on public.portal_accesos for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "portal_accesos all service role" on public.portal_accesos;
create policy "portal_accesos all service role"
  on public.portal_accesos for all to service_role
  using (true) with check (true);

create index if not exists idx_portal_accesos_roles
  on public.portal_accesos using gin (roles);
