-- SmartTaller — Verificar bucket Storage diagnósticos
-- Resultado esperado: 1 fila con id = diagnosticos

select id, name, public, file_size_limit
from storage.buckets
where id = 'diagnosticos';
