-- Producción puede tener mantenimientos.vehiculo_id con ON DELETE NO ACTION,
-- lo que bloquea borrar expedientes/vehículos. Alinear a SET NULL (como en migraciones).

alter table public.mantenimientos
  drop constraint if exists mantenimientos_vehiculo_id_fkey;

alter table public.mantenimientos
  add constraint mantenimientos_vehiculo_id_fkey
  foreign key (vehiculo_id)
  references public.vehiculos (id)
  on delete set null;
