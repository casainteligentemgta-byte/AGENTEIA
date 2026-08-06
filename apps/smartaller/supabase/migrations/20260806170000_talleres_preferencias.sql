-- Preferencias del taller (p. ej. último importador Puerto Libre).
alter table public.talleres
  add column if not exists preferencias jsonb not null default '{}'::jsonb;

comment on column public.talleres.preferencias is
  'Ajustes del taller: ultimoImportador { importadorNombre, importadorDocumento, importadorTelefono, importadorEmail }, etc.';
