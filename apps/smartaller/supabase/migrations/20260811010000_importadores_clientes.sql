-- Clientes / importadores del módulo Importación (personas naturales o jurídicas).
-- RLS por taller. Las Server Actions PL usan service_role + requireTallerAuth.

create table if not exists public.importadores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  tipo text not null check (tipo in ('natural', 'juridica')),
  -- Display / búsqueda (natural: nombres; jurídica: razón social)
  nombre text not null,
  -- RIF (único por taller)
  documento text not null,
  -- Natural: cédula propia. Jurídica: cédula del representante (denormalizada).
  cedula text,
  telefono text,
  email text,
  direccion text,
  instagram text,
  -- Jurídica
  denominacion_comercial text,
  razon_social text,
  rep_legal_nombre text,
  rep_legal_cedula text,
  rep_legal_email text,
  rep_legal_telefono text,
  empresa_telefono text,
  empresa_email text,
  empresa_domicilio text,
  registro_puerto_libre text,
  registro_pl_vence date,
  activo boolean not null default true,
  constraint importadores_taller_documento_unique unique (taller_id, documento)
);

comment on table public.importadores is
  'Clientes importadores del módulo Importación: persona natural o jurídica por taller.';

create index if not exists idx_importadores_taller
  on public.importadores (taller_id);

create index if not exists idx_importadores_taller_activo
  on public.importadores (taller_id, activo);

create index if not exists idx_importadores_taller_nombre
  on public.importadores (taller_id, nombre);

alter table public.importadores enable row level security;

drop policy if exists "importadores select own taller" on public.importadores;
create policy "importadores select own taller"
  on public.importadores for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "importadores insert own taller" on public.importadores;
create policy "importadores insert own taller"
  on public.importadores for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "importadores update own taller" on public.importadores;
create policy "importadores update own taller"
  on public.importadores for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "importadores delete own taller" on public.importadores;
create policy "importadores delete own taller"
  on public.importadores for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "importadores all service role" on public.importadores;
create policy "importadores all service role"
  on public.importadores for all to service_role
  using (true) with check (true);
