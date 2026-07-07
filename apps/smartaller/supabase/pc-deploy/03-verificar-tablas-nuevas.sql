-- SmartTaller — Verificar tablas nuevas (jul 5–10)
-- Resultado esperado: 6 filas

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'repuestos',
    'mantenimiento_repuestos',
    'bikes',
    'bike_components',
    'shops',
    'maintenance_protocols'
  )
order by 1;

-- Columnas Stripe en perfiles (debe devolver 2 filas)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'perfiles'
  and column_name in ('stripe_customer_id', 'stripe_subscription_id')
order by 1;

-- Link bikes ↔ vehículos (debe devolver 1 fila)
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'bikes'
  and column_name = 'vehiculo_id';
