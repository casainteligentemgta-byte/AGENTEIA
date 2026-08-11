-- Documentos escaneados del cliente importador (RIF / cédula).
-- Misma forma que vehiculos.documentos: { rif?: {url,path,...}, cedula?: {...} }

alter table public.importadores
  add column if not exists documentos jsonb not null default '{}'::jsonb;

comment on column public.importadores.documentos is
  'Archivos del cliente: { rif?: {url,path,scanned_at,file_name}, cedula?: {...} }. Storage: vehiculos-documentos.';
