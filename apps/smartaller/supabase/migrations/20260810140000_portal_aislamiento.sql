-- Aislamiento (cuarentena) antes del borrado definitivo.
-- Solo el administrador máster ve entidades aisladas; el resto no las lista.

alter table public.talleres
  add column if not exists aislado_at timestamptz,
  add column if not exists aislado_por uuid references auth.users (id) on delete set null;

comment on column public.talleres.aislado_at is
  'Si no es null, el taller/concesionario está en aislamiento: invisible para el resto, solo máster.';

create index if not exists idx_talleres_aislado_at
  on public.talleres (aislado_at)
  where aislado_at is not null;

alter table public.portal_accesos
  add column if not exists aislado_at timestamptz,
  add column if not exists aislado_por uuid references auth.users (id) on delete set null;

comment on column public.portal_accesos.aislado_at is
  'Si no es null, el acceso de portal está aislado: invisible/inactivo salvo para máster.';

create index if not exists idx_portal_accesos_aislado_at
  on public.portal_accesos (aislado_at)
  where aislado_at is not null;

-- Dueño de taller aislado no obtiene taller_id (oculta su flota vía RLS).
create or replace function public.get_my_taller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.talleres
  where owner_user_id = auth.uid()
    and aislado_at is null
  limit 1;
$$;
