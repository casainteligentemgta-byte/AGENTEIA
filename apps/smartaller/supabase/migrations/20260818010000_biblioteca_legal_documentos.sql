-- PDFs de la biblioteca legal (decretos, leyes, anexos, aranceles, gacetas).
-- Storage: bucket vehiculos-documentos, ruta {taller_id}/biblioteca-legal/{id}.pdf
-- Server Actions usan service_role + getMyTaller(); RLS cubre acceso cliente.

create table if not exists public.biblioteca_legal_documentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  categoria text not null check (
    categoria in (
      'decreto',
      'ley',
      'reglamento',
      'resolucion',
      'anexo',
      'arancel',
      'gaceta',
      'otro'
    )
  ),
  titulo text not null,
  descripcion text,
  organismo text,
  anio integer,
  norma_id text,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  file_size integer
);

comment on table public.biblioteca_legal_documentos is
  'PDFs oficiales del taller: decretos, leyes, anexos, aranceles y gacetas para la biblioteca legal.';

create index if not exists idx_biblioteca_legal_docs_taller
  on public.biblioteca_legal_documentos (taller_id, created_at desc);

create index if not exists idx_biblioteca_legal_docs_categoria
  on public.biblioteca_legal_documentos (taller_id, categoria);

alter table public.biblioteca_legal_documentos enable row level security;

drop policy if exists "biblioteca legal select own taller" on public.biblioteca_legal_documentos;
create policy "biblioteca legal select own taller"
  on public.biblioteca_legal_documentos for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "biblioteca legal insert own taller" on public.biblioteca_legal_documentos;
create policy "biblioteca legal insert own taller"
  on public.biblioteca_legal_documentos for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "biblioteca legal update own taller" on public.biblioteca_legal_documentos;
create policy "biblioteca legal update own taller"
  on public.biblioteca_legal_documentos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "biblioteca legal delete own taller" on public.biblioteca_legal_documentos;
create policy "biblioteca legal delete own taller"
  on public.biblioteca_legal_documentos for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "biblioteca legal all service role" on public.biblioteca_legal_documentos;
create policy "biblioteca legal all service role"
  on public.biblioteca_legal_documentos for all to service_role
  using (true) with check (true);
