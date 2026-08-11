-- Amplía importadores: campos natural vs jurídica + registro Puerto Libre.
-- Idempotente si ya corriste la versión completa de 20260811010000.

alter table public.importadores
  add column if not exists cedula text,
  add column if not exists instagram text,
  add column if not exists denominacion_comercial text,
  add column if not exists razon_social text,
  add column if not exists rep_legal_nombre text,
  add column if not exists rep_legal_cedula text,
  add column if not exists rep_legal_email text,
  add column if not exists rep_legal_telefono text,
  add column if not exists empresa_telefono text,
  add column if not exists empresa_email text,
  add column if not exists empresa_domicilio text,
  add column if not exists registro_puerto_libre text,
  add column if not exists registro_pl_vence date;

comment on column public.importadores.cedula is
  'Cédula: propia si natural; del representante legal si jurídica (también en rep_legal_cedula).';
comment on column public.importadores.registro_puerto_libre is
  'Nº de registro Puerto Libre (obligatorio en persona jurídica).';
comment on column public.importadores.registro_pl_vence is
  'Vencimiento del registro Puerto Libre (persona jurídica).';
