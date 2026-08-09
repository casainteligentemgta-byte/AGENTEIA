-- Módulo Importación: rol admin, logs de ingreso y vehículos compartidos.
-- Roles producto: master (máster), admin, taller, concesionario, usuario.
-- Se mantiene aduanera por compatibilidad.

-- 1) Ampliar roles permitidos en portal_accesos
alter table public.portal_accesos
  drop constraint if exists portal_accesos_roles_valid;

alter table public.portal_accesos
  add constraint portal_accesos_roles_valid check (
    roles <@ array[
      'master',
      'admin',
      'aduanera',
      'taller',
      'concesionario',
      'usuario'
    ]::text[]
  );

comment on table public.portal_accesos is
  'Acceso a portales SmartTaller / Importación. Roles: master, admin, taller, concesionario, usuario (+ aduanera legacy).';

-- 2) Registro de ingresos (login) de usuarios registrados
create table if not exists public.portal_login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  roles text[] not null default '{}'::text[],
  path text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.portal_login_logs is
  'Ingresos (login) de usuarios. Solo el administrador máster puede consultarlos vía service role.';

create index if not exists idx_portal_login_logs_created_at
  on public.portal_login_logs (created_at desc);

create index if not exists idx_portal_login_logs_user_id
  on public.portal_login_logs (user_id);

alter table public.portal_login_logs enable row level security;

-- Sin políticas para authenticated: lectura/escritura solo service_role (Server Actions).
drop policy if exists "portal_login_logs all service role" on public.portal_login_logs;
create policy "portal_login_logs all service role"
  on public.portal_login_logs for all to service_role
  using (true) with check (true);

-- 3) Vehículos compartidos con usuarios (admin/máster → usuario)
create table if not exists public.vehiculo_compartidos (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shared_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint vehiculo_compartidos_unique unique (vehiculo_id, user_id)
);

comment on table public.vehiculo_compartidos is
  'Vehículos que un administrador comparte con un usuario (además de propiedad por vehiculos.user_id).';

create index if not exists idx_vehiculo_compartidos_user_id
  on public.vehiculo_compartidos (user_id);

create index if not exists idx_vehiculo_compartidos_vehiculo_id
  on public.vehiculo_compartidos (vehiculo_id);

alter table public.vehiculo_compartidos enable row level security;

drop policy if exists "vehiculo_compartidos select own" on public.vehiculo_compartidos;
create policy "vehiculo_compartidos select own"
  on public.vehiculo_compartidos for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "vehiculo_compartidos all service role" on public.vehiculo_compartidos;
create policy "vehiculo_compartidos all service role"
  on public.vehiculo_compartidos for all to service_role
  using (true) with check (true);
