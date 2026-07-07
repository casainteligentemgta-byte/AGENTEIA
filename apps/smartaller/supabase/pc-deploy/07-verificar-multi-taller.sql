-- SmartTaller — Verificación multi-taller (post-migración base)

-- SmartTaller: script de verificación post-migración multi-taller
-- Ejecuta TODO esto en Supabase → SQL Editor → Run
-- Si algo falla, copia el resultado y compártelo.

-- 1) ¿Existe la tabla talleres?
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'talleres'
    ) then 'OK: tabla talleres existe'
    else 'ERROR: falta tabla talleres — ejecuta la migración multi-taller'
  end as check_talleres;

-- 2) Columnas esperadas en talleres
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'talleres'
order by ordinal_position;

-- 2b) ¿telegram_chat_id es nullable? (debe ser YES)
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'talleres'
        and column_name = 'telegram_chat_id'
        and is_nullable = 'YES'
    ) then 'OK: telegram_chat_id es nullable'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'talleres'
        and column_name = 'telegram_chat_id'
    ) then 'ERROR: telegram_chat_id tiene NOT NULL — ejecuta: alter table public.talleres alter column telegram_chat_id drop not null;'
    else 'ERROR: falta columna telegram_chat_id'
  end as check_telegram_nullable;

-- 3) ¿Columna taller_id en vehiculos y mantenimientos?
select
  'vehiculos.taller_id' as columna,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehiculos' and column_name = 'taller_id'
  ) then 'OK' else 'ERROR: falta taller_id en vehiculos' end as estado
union all
select
  'mantenimientos.taller_id',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mantenimientos' and column_name = 'taller_id'
  ) then 'OK' else 'ERROR: falta taller_id en mantenimientos' end;

-- 4) ¿Función get_my_taller_id?
select
  case
    when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_my_taller_id'
    ) then 'OK: función get_my_taller_id existe'
    else 'ERROR: falta función get_my_taller_id'
  end as check_funcion;

-- 5) Políticas RLS en talleres
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'talleres'
order by policyname;

-- 6) ¿Hay talleres creados? (debería haber al menos 1 si ya entraste al dashboard)
select count(*) as total_talleres from public.talleres;

-- 7) Muestra talleres (sin datos sensibles)
select id, nombre, owner_user_id, telegram_chat_id, codigo_vinculo, created_at
from public.talleres
order by created_at desc
limit 10;

-- 8) Resumen tablas SmartTaller
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('talleres', 'vehiculos', 'mantenimientos', 'recordatorios')
order by table_name;
