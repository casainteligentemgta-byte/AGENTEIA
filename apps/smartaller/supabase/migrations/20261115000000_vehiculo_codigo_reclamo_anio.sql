-- Código de reclamo por vehículo + año.
-- NO aplicar desde el agente: el dueño la ejecuta en SQL Editor / `supabase db push`.
--
-- Seguridad: el dueño ya no usa talleres.codigo_vinculo (ese sigue siendo
-- solo para Telegram /vincular). Cada vehículo tiene un código de un solo uso
-- que se borra al reclamarlo. pin_hash se deja para NFC; no se reutiliza.

alter table public.vehiculos
  add column if not exists codigo_reclamo text,
  add column if not exists codigo_reclamo_generado_at timestamptz,
  add column if not exists anio integer;

comment on column public.vehiculos.codigo_reclamo is
  'Código de un solo uso para que el dueño reclame ESTE vehículo en la app. Se anula al vincular. Distinto de talleres.codigo_vinculo (Telegram).';

comment on column public.vehiculos.codigo_reclamo_generado_at is
  'Momento en que se generó o regeneró codigo_reclamo.';

comment on column public.vehiculos.anio is
  'Año del modelo (opcional).';

alter table public.vehiculos
  drop constraint if exists vehiculos_anio_rango;

alter table public.vehiculos
  add constraint vehiculos_anio_rango
  check (anio is null or (anio >= 1950 and anio <= 2100));

create unique index if not exists vehiculos_codigo_reclamo_activo_idx
  on public.vehiculos (codigo_reclamo)
  where codigo_reclamo is not null;
