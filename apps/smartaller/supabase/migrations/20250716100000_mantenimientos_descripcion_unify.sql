-- Unificar descripcion como columna canonica en mantenimientos.
-- Produccion puede tener solo descripcion (sin descripcion_servicio).

alter table public.mantenimientos
  add column if not exists descripcion text;

-- Migrar datos legacy si aun existe descripcion_servicio
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mantenimientos'
      and column_name = 'descripcion_servicio'
  ) then
    execute $sql$
      update public.mantenimientos
      set descripcion = descripcion_servicio
      where descripcion is null and descripcion_servicio is not null
    $sql$;
  end if;
end $$;
