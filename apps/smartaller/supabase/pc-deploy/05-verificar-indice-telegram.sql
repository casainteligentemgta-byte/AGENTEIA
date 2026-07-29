-- SmartTaller — Verificar índice único Telegram (idempotencia facturas)
-- Resultado esperado: 1 fila idx_mantenimientos_telegram_msg

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'idx_mantenimientos_telegram_msg';

-- Smoke: contar políticas en repuestos (debe ser >= 4)
select count(*) as politicas_repuestos
from pg_policies
where schemaname = 'public'
  and tablename = 'repuestos';
