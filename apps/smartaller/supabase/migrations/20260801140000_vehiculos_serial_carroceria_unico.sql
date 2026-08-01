-- Unicidad de serial de carrocería por taller (ignora vacíos / null).
-- Comparación case-insensitive y sin espacios extremos (upper + trim).

create unique index if not exists idx_vehiculos_serial_carroceria_taller
  on public.vehiculos (taller_id, (upper(trim(serial_carroceria))))
  where taller_id is not null
    and serial_carroceria is not null
    and trim(serial_carroceria) <> '';

comment on index public.idx_vehiculos_serial_carroceria_taller is
  'Un serial de carrocería no puede repetirse en dos vehículos del mismo taller';
