-- Reestructura planilla Puerto Libre:
-- Antes: 1 registro(+1a UI), 2 llegada … 7 completa
-- Ahora: 1 registro, 2 embarque, 3 llegada … 8 completa
-- Remapea fases >= 2 sumando 1 (la 1 se queda).

update public.vehiculos
set
  importacion = jsonb_set(
    importacion,
    '{planilla_fase}',
    to_jsonb((importacion->>'planilla_fase')::int + 1),
    true
  ),
  updated_at = now()
where importacion ? 'planilla_fase'
  and jsonb_typeof(importacion->'planilla_fase') = 'number'
  and (importacion->>'planilla_fase')::int between 2 and 7;

-- Filas legacy con clave camelCase
update public.vehiculos
set
  importacion = jsonb_set(
    importacion - 'planillaFase',
    '{planilla_fase}',
    to_jsonb((importacion->>'planillaFase')::int + 1),
    true
  ),
  updated_at = now()
where importacion ? 'planillaFase'
  and not (importacion ? 'planilla_fase')
  and (importacion->>'planillaFase') ~ '^[0-9]+$'
  and (importacion->>'planillaFase')::int between 2 and 7;
