-- Buckets de evidencias y documentos de importación: de públicos a privados.
-- Las rutas almacenadas (path) no cambian; el código firma URLs (createSignedUrl)
-- y las sirve por /api/storage/file. Desplegar el código ANTES de esta migración.

update storage.buckets
set public = false
where id in ('diagnosticos', 'recepcion-estado-visual', 'vehiculos-documentos');

drop policy if exists "recepcion visual public read" on storage.objects;
