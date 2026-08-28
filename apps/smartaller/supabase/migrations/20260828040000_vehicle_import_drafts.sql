-- Borrador del flujo de 3 pasos para importar vehículos.
-- Un draft por usuario y taller. Server Actions usan service_role + requireTallerAuth.
-- Aplicar en el SQL Editor de Supabase (proyecto SmartTaller / SmartImport) si aún no corre:
--   apps/smartaller/supabase/migrations/20260828040000_vehicle_import_drafts.sql
-- Idempotente (IF NOT EXISTS + drop policy if exists). RLS: propio + service_role.

create table if not exists public.vehicle_import_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taller_id uuid not null references public.talleres (id) on delete cascade,
  step integer not null default 1 check (step in (1, 2, 3)),
  vehicles jsonb not null default '[]'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_import_drafts_user_taller_unique unique (user_id, taller_id)
);

comment on table public.vehicle_import_drafts is
  'Borrador de importación de vehículos: 1 por usuario/taller. vehicles[] {marca/mark, modelo/model, vin, status draft|complete}; documents {factura_url, certificates_urls[]}';

comment on column public.vehicle_import_drafts.vehicles is
  'Array de vehículos extraídos/editados, cada uno con status draft|complete.';

comment on column public.vehicle_import_drafts.documents is
  'Referencias a factura y certificados: {factura_url, certificates_urls[], facturaName, certificadoNames, importadorId, ...}.';

create index if not exists idx_vehicle_import_drafts_taller
  on public.vehicle_import_drafts (taller_id, updated_at desc);

alter table public.vehicle_import_drafts enable row level security;

drop policy if exists "vehicle_import_drafts select own" on public.vehicle_import_drafts;
create policy "vehicle_import_drafts select own"
  on public.vehicle_import_drafts for select to authenticated
  using (
    user_id = auth.uid()
    and taller_id = public.get_my_taller_id()
  );

drop policy if exists "vehicle_import_drafts insert own" on public.vehicle_import_drafts;
create policy "vehicle_import_drafts insert own"
  on public.vehicle_import_drafts for insert to authenticated
  with check (
    user_id = auth.uid()
    and taller_id = public.get_my_taller_id()
  );

drop policy if exists "vehicle_import_drafts update own" on public.vehicle_import_drafts;
create policy "vehicle_import_drafts update own"
  on public.vehicle_import_drafts for update to authenticated
  using (
    user_id = auth.uid()
    and taller_id = public.get_my_taller_id()
  )
  with check (
    user_id = auth.uid()
    and taller_id = public.get_my_taller_id()
  );

drop policy if exists "vehicle_import_drafts delete own" on public.vehicle_import_drafts;
create policy "vehicle_import_drafts delete own"
  on public.vehicle_import_drafts for delete to authenticated
  using (
    user_id = auth.uid()
    and taller_id = public.get_my_taller_id()
  );

drop policy if exists "vehicle_import_drafts all service role" on public.vehicle_import_drafts;
create policy "vehicle_import_drafts all service role"
  on public.vehicle_import_drafts for all to service_role
  using (true) with check (true);
