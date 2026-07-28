-- Puerto Libre: datos de importación y docs adicionales en vehiculos.

alter table public.vehiculos
  add column if not exists importacion jsonb not null default '{}'::jsonb;

comment on column public.vehiculos.importacion is
  'Datos de importación Puerto Libre: regimen, aduana, BL, origen, CIF, fechas, agente, notas';
