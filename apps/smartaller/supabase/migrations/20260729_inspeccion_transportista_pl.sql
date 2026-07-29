-- Inspección al recibir en transportista (Puerto Libre), aislada de ingreso a taller.

alter table public.vehiculos
  add column if not exists inspeccion_transportista jsonb not null default '{}'::jsonb;

comment on column public.vehiculos.inspeccion_transportista is
  'Acta de recepción en transportista (Puerto Libre): checklist, transportista, guía, firmas. No es orden_recepcion de taller.';
