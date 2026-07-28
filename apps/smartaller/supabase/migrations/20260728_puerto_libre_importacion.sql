-- Puerto Libre: datos de importación, seguro y docs adicionales en vehiculos.

alter table public.vehiculos
  add column if not exists importacion jsonb not null default '{}'::jsonb;

alter table public.vehiculos
  add column if not exists seguro jsonb not null default '{}'::jsonb;

comment on column public.vehiculos.importacion is
  'Datos Puerto Libre: regimen, aduana, BL, origen, CIF, estado_nacionalizacion, fecha_limite_nacionalizacion, estado_seniat, fecha_presentacion_seniat';

comment on column public.vehiculos.seguro is
  'Seguro del vehículo: aseguradora, póliza, coberturas, vigencias; docs en vehiculos.documentos';
