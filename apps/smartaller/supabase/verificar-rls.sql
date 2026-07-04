-- Verificación pre-deploy: políticas RLS permisivas en tablas core
-- Ejecutar en Supabase SQL Editor. Resultado esperado: 0 filas.

select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('mantenimientos', 'vehiculos', 'recordatorios', 'talleres', 'perfiles')
  and roles @> '{authenticated}'
  and (qual = 'true' or qual is null);

-- Índice idempotencia Telegram
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname = 'idx_mantenimientos_telegram_msg';
