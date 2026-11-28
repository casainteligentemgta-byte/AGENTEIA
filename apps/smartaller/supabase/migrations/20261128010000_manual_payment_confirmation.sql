-- Confirmación manual de pagos (Pago Móvil).
-- NO aplicar a producción desde el agente: Luis la ejecuta en SQL Editor.
--
-- Incluye:
-- - plan_suscripcion en talleres (ya existe en prod; idempotente)
-- - suscripcion_activa / vencimiento_plan en talleres + cortesía 30 días
--   para talleres existentes en el momento de aplicar
-- - RLS: usuarios no pueden cambiar columnas de billing en perfiles/talleres
-- - reportes_pago, exoneraciones, tasas BCV, notificaciones, recordatorios
-- - bucket privado comprobantes-pago
-- - usuario_suscripcion_activa() honra exoneraciones
-- - taller_suscripcion_activa()

-- ---------------------------------------------------------------------------
-- 1) Talleres: plan + suscripción
-- ---------------------------------------------------------------------------
alter table public.talleres
  add column if not exists plan_suscripcion text default 'basic';

update public.talleres
set plan_suscripcion = 'basic'
where plan_suscripcion is null;

alter table public.talleres
  alter column plan_suscripcion set default 'basic';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'talleres'
      and column_name = 'plan_suscripcion'
      and is_nullable = 'YES'
  ) then
    alter table public.talleres alter column plan_suscripcion set not null;
  end if;
end
$$;

comment on column public.talleres.plan_suscripcion is
  'Plan comercial del taller (basic al crear; pro al aprobar pago). Ya existía en prod.';

alter table public.talleres
  add column if not exists suscripcion_activa boolean not null default false;

alter table public.talleres
  add column if not exists vencimiento_plan timestamptz;

comment on column public.talleres.suscripcion_activa is
  'Si el taller tiene el plan de USD 100/mes activo (lo cambia solo service_role).';
comment on column public.talleres.vencimiento_plan is
  'Fin del periodo pagado o de la cortesía de lanzamiento.';

-- Cortesía de lanzamiento: talleres YA existentes quedan activos 30 días
-- para que /dashboard no se cierre el día del deploy. Talleres creados
-- después de esta sentencia nacen inactivos y deben reportar Pago Móvil.
update public.talleres
set
  suscripcion_activa = true,
  vencimiento_plan = now() + interval '30 days'
where vencimiento_plan is null
  and suscripcion_activa = false;

-- ---------------------------------------------------------------------------
-- 2) Proteger columnas de billing (perfiles y talleres)
-- ---------------------------------------------------------------------------
create or replace function public.perfiles_protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    NEW.tipo_plan := 'free';
    NEW.suscripcion_activa := false;
    NEW.vencimiento_plan := null;
    NEW.stripe_customer_id := null;
    NEW.stripe_subscription_id := null;
    return NEW;
  end if;
  NEW.tipo_plan := OLD.tipo_plan;
  NEW.suscripcion_activa := OLD.suscripcion_activa;
  NEW.vencimiento_plan := OLD.vencimiento_plan;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  return NEW;
end;
$$;

drop trigger if exists perfiles_protect_billing_columns on public.perfiles;
create trigger perfiles_protect_billing_columns
  before insert or update on public.perfiles
  for each row
  execute function public.perfiles_protect_billing_columns();

-- Usuarios autenticados no actualizan su perfil (el billing solo lo toca service_role).
drop policy if exists "perfiles update own" on public.perfiles;

create or replace function public.talleres_protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return NEW;
  end if;
  NEW.plan_suscripcion := OLD.plan_suscripcion;
  NEW.suscripcion_activa := OLD.suscripcion_activa;
  NEW.vencimiento_plan := OLD.vencimiento_plan;
  return NEW;
end;
$$;

drop trigger if exists talleres_protect_billing_columns on public.talleres;
create trigger talleres_protect_billing_columns
  before update on public.talleres
  for each row
  execute function public.talleres_protect_billing_columns();

-- ---------------------------------------------------------------------------
-- 3) Tasa BCV cacheada (reutiliza la fuente de importación / cron existente)
-- ---------------------------------------------------------------------------
create table if not exists public.tasas_cambio_bcv (
  fecha date primary key,
  tasa numeric(18, 6) not null check (tasa > 0),
  fuente text not null default 'bcv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasas_cambio_bcv is
  'Tasa oficial BCV (Bs por 1 USD) por día civil America/Caracas. Fallback si falla la API.';

alter table public.tasas_cambio_bcv enable row level security;

drop policy if exists "tasas_cambio_bcv public read" on public.tasas_cambio_bcv;
create policy "tasas_cambio_bcv public read"
  on public.tasas_cambio_bcv for select
  using (true);

drop policy if exists "tasas_cambio_bcv service role" on public.tasas_cambio_bcv;
create policy "tasas_cambio_bcv service role"
  on public.tasas_cambio_bcv for all to service_role
  using (true) with check (true);

grant select on public.tasas_cambio_bcv to anon, authenticated;
grant all on public.tasas_cambio_bcv to service_role;

-- ---------------------------------------------------------------------------
-- 4) Exoneraciones
-- ---------------------------------------------------------------------------
create table if not exists public.exoneraciones_suscripcion (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  tipo text not null check (tipo in ('perfil', 'taller_clientes', 'taller')),
  perfil_id uuid references public.perfiles (id) on delete cascade,
  taller_id uuid references public.talleres (id) on delete cascade,
  vigente_hasta timestamptz,
  notas text,
  activa boolean not null default true,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id),
  constraint exoneraciones_target_check check (
    (tipo = 'perfil' and perfil_id is not null and taller_id is null)
    or (tipo in ('taller_clientes', 'taller') and taller_id is not null and perfil_id is null)
  )
);

comment on table public.exoneraciones_suscripcion is
  'Exoneraciones de paywall: perfil (B2C), taller_clientes (clientes vinculados) o taller (plan USD 100).';

create unique index if not exists exoneraciones_perfil_activa_uidx
  on public.exoneraciones_suscripcion (perfil_id)
  where activa and tipo = 'perfil';

create unique index if not exists exoneraciones_taller_tipo_activa_uidx
  on public.exoneraciones_suscripcion (taller_id, tipo)
  where activa and tipo in ('taller', 'taller_clientes');

create index if not exists idx_exoneraciones_perfil on public.exoneraciones_suscripcion (perfil_id);
create index if not exists idx_exoneraciones_taller on public.exoneraciones_suscripcion (taller_id);
create index if not exists idx_exoneraciones_created_by on public.exoneraciones_suscripcion (created_by);

alter table public.exoneraciones_suscripcion enable row level security;

drop policy if exists "exoneraciones select own related" on public.exoneraciones_suscripcion;
create policy "exoneraciones select own related"
  on public.exoneraciones_suscripcion for select to authenticated
  using (
    (tipo = 'perfil' and perfil_id = auth.uid())
    or (
      tipo = 'taller'
      and taller_id in (select id from public.talleres where owner_user_id = auth.uid())
    )
    or (
      tipo = 'taller_clientes'
      and taller_id in (
        select v.taller_id from public.vehiculos v
        where v.user_id = auth.uid() and v.taller_id is not null
      )
    )
  );

drop policy if exists "exoneraciones service role" on public.exoneraciones_suscripcion;
create policy "exoneraciones service role"
  on public.exoneraciones_suscripcion for all to service_role
  using (true) with check (true);

grant select on public.exoneraciones_suscripcion to authenticated;
grant all on public.exoneraciones_suscripcion to service_role;

-- ---------------------------------------------------------------------------
-- 5) Reportes de Pago Móvil
-- ---------------------------------------------------------------------------
create table if not exists public.reportes_pago (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo_plan text not null check (tipo_plan in ('b2c', 'taller')),
  taller_id uuid references public.talleres (id) on delete set null,
  monto numeric(12, 2) not null check (monto > 0),
  moneda text not null check (moneda in ('USD', 'VES')),
  referencia text not null,
  fecha_pago date not null,
  comprobante_path text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_at timestamptz,
  notas text,
  periodo_inicio timestamptz,
  periodo_fin timestamptz,
  constraint reportes_pago_taller_required check (
    (tipo_plan = 'b2c' and taller_id is null)
    or (tipo_plan = 'taller' and taller_id is not null)
  )
);

comment on table public.reportes_pago is
  'Reportes de Pago Móvil. Un pendiente por usuario. Solo service_role aprueba o rechaza.';

create unique index if not exists reportes_pago_one_pending_per_user
  on public.reportes_pago (user_id)
  where estado = 'pendiente';

create index if not exists idx_reportes_pago_user on public.reportes_pago (user_id);
create index if not exists idx_reportes_pago_estado on public.reportes_pago (estado, created_at desc);
create index if not exists idx_reportes_pago_taller on public.reportes_pago (taller_id);
create index if not exists idx_reportes_pago_revisado_por on public.reportes_pago (revisado_por);

alter table public.reportes_pago enable row level security;

drop policy if exists "reportes_pago select own" on public.reportes_pago;
create policy "reportes_pago select own"
  on public.reportes_pago for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "reportes_pago insert own" on public.reportes_pago;
create policy "reportes_pago insert own"
  on public.reportes_pago for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and estado = 'pendiente'
    and revisado_por is null
    and revisado_at is null
    and periodo_inicio is null
    and periodo_fin is null
  );

-- Cancelar propio pendiente: solo permite pasar a cancelado.
drop policy if exists "reportes_pago cancel own pending" on public.reportes_pago;
create policy "reportes_pago cancel own pending"
  on public.reportes_pago for update to authenticated
  using (
    user_id = (select auth.uid())
    and estado = 'pendiente'
  )
  with check (
    user_id = (select auth.uid())
    and estado = 'cancelado'
  );

drop policy if exists "reportes_pago service role" on public.reportes_pago;
create policy "reportes_pago service role"
  on public.reportes_pago for all to service_role
  using (true) with check (true);

grant select, insert on public.reportes_pago to authenticated;
grant update (estado, updated_at) on public.reportes_pago to authenticated;
grant all on public.reportes_pago to service_role;

-- Impide que el cliente cambie monto/referencia al cancelar.
create or replace function public.reportes_pago_restrict_user_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return NEW;
  end if;
  if OLD.estado is distinct from 'pendiente' or NEW.estado is distinct from 'cancelado' then
    raise exception 'Solo puedes cancelar un reporte pendiente';
  end if;
  NEW.user_id := OLD.user_id;
  NEW.tipo_plan := OLD.tipo_plan;
  NEW.taller_id := OLD.taller_id;
  NEW.monto := OLD.monto;
  NEW.moneda := OLD.moneda;
  NEW.referencia := OLD.referencia;
  NEW.fecha_pago := OLD.fecha_pago;
  NEW.comprobante_path := OLD.comprobante_path;
  NEW.revisado_por := OLD.revisado_por;
  NEW.revisado_at := OLD.revisado_at;
  NEW.notas := OLD.notas;
  NEW.periodo_inicio := OLD.periodo_inicio;
  NEW.periodo_fin := OLD.periodo_fin;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists reportes_pago_restrict_user_update on public.reportes_pago;
create trigger reportes_pago_restrict_user_update
  before update on public.reportes_pago
  for each row
  execute function public.reportes_pago_restrict_user_update();

-- ---------------------------------------------------------------------------
-- 6) Notificaciones in-app y anti-duplicado de recordatorios
-- ---------------------------------------------------------------------------
create table if not exists public.notificaciones_usuario (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null default 'suscripcion',
  titulo text not null,
  cuerpo text not null,
  leida boolean not null default false,
  leida_at timestamptz
);

comment on table public.notificaciones_usuario is
  'Avisos in-app (p. ej. recordatorio 7 y 3 días antes del vencimiento).';

create index if not exists idx_notificaciones_usuario_user
  on public.notificaciones_usuario (user_id, leida, created_at desc);

alter table public.notificaciones_usuario enable row level security;

drop policy if exists "notificaciones select own" on public.notificaciones_usuario;
create policy "notificaciones select own"
  on public.notificaciones_usuario for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notificaciones update own read" on public.notificaciones_usuario;
create policy "notificaciones update own read"
  on public.notificaciones_usuario for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notificaciones service role" on public.notificaciones_usuario;
create policy "notificaciones service role"
  on public.notificaciones_usuario for all to service_role
  using (true) with check (true);

grant select on public.notificaciones_usuario to authenticated;
grant update (leida, leida_at) on public.notificaciones_usuario to authenticated;
grant all on public.notificaciones_usuario to service_role;

create table if not exists public.suscripcion_recordatorios_enviados (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taller_id uuid references public.talleres (id) on delete cascade,
  tipo_plan text not null check (tipo_plan in ('b2c', 'taller')),
  dias_antes integer not null check (dias_antes in (3, 7)),
  vencimiento_plan timestamptz not null,
  canal text not null default 'in_app'
);

create unique index if not exists suscripcion_recordatorios_uidx
  on public.suscripcion_recordatorios_enviados (user_id, tipo_plan, dias_antes, vencimiento_plan);

create index if not exists idx_suscripcion_recordatorios_user
  on public.suscripcion_recordatorios_enviados (user_id);

alter table public.suscripcion_recordatorios_enviados enable row level security;

drop policy if exists "suscripcion_recordatorios service role" on public.suscripcion_recordatorios_enviados;
create policy "suscripcion_recordatorios service role"
  on public.suscripcion_recordatorios_enviados for all to service_role
  using (true) with check (true);

grant all on public.suscripcion_recordatorios_enviados to service_role;

-- ---------------------------------------------------------------------------
-- 7) Funciones de acceso (honran exoneración)
-- ---------------------------------------------------------------------------
create or replace function public.exoneracion_b2c_vigente(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      p_user_id = auth.uid()
      or current_user in ('service_role', 'postgres', 'supabase_admin')
    )
    and (
    exists (
      select 1
      from public.exoneraciones_suscripcion e
      where e.activa
        and e.tipo = 'perfil'
        and e.perfil_id = p_user_id
        and (e.vigente_hasta is null or e.vigente_hasta > now())
    )
    or exists (
      select 1
      from public.vehiculos v
      join public.exoneraciones_suscripcion e
        on e.taller_id = v.taller_id
       and e.activa
       and e.tipo = 'taller_clientes'
       and (e.vigente_hasta is null or e.vigente_hasta > now())
      where v.user_id = p_user_id
        and v.taller_id is not null
    )
    );
$$;

create or replace function public.exoneracion_taller_vigente(p_taller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      p_taller_id = public.get_my_taller_id()
      or current_user in ('service_role', 'postgres', 'supabase_admin')
    )
    and exists (
      select 1
      from public.exoneraciones_suscripcion e
      where e.activa
        and e.tipo = 'taller'
        and e.taller_id = p_taller_id
        and (e.vigente_hasta is null or e.vigente_hasta > now())
    );
$$;

create or replace function public.usuario_suscripcion_activa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.exoneracion_b2c_vigente(auth.uid()),
    false
  )
  or coalesce(
    (
      select p.suscripcion_activa
        and (p.vencimiento_plan is null or p.vencimiento_plan > now())
      from public.perfiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.taller_suscripcion_activa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        public.exoneracion_taller_vigente(t.id)
        or (
          t.suscripcion_activa
          and (t.vencimiento_plan is null or t.vencimiento_plan > now())
        )
      from public.talleres t
      where t.id = public.get_my_taller_id()
    ),
    false
  );
$$;

revoke execute on function public.exoneracion_b2c_vigente(uuid) from public, anon;
grant execute on function public.exoneracion_b2c_vigente(uuid) to authenticated, service_role;

revoke execute on function public.exoneracion_taller_vigente(uuid) from public, anon;
grant execute on function public.exoneracion_taller_vigente(uuid) to authenticated, service_role;

revoke execute on function public.usuario_suscripcion_activa() from public, anon;
grant execute on function public.usuario_suscripcion_activa() to authenticated, service_role;

revoke execute on function public.taller_suscripcion_activa() from public, anon;
grant execute on function public.taller_suscripcion_activa() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) Storage: comprobantes-pago (privado, imagen/PDF ≤ 10 MB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-pago',
  'comprobantes-pago',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprobantes pago insert own" on storage.objects;
create policy "comprobantes pago insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes-pago'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "comprobantes pago select own" on storage.objects;
create policy "comprobantes pago select own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes-pago'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "comprobantes pago service role" on storage.objects;
create policy "comprobantes pago service role"
  on storage.objects for all to service_role
  using (bucket_id = 'comprobantes-pago')
  with check (bucket_id = 'comprobantes-pago');
