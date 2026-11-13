-- Copiar y pegar en Supabase → SQL Editor DESPUÉS de desplegar el código
-- que usa /api/storage/file y createSignedUrl.
-- Origen: supabase/migrations/20261113000000_storage_buckets_private.sql

update storage.buckets
set public = false
where id in ('diagnosticos', 'recepcion-estado-visual', 'vehiculos-documentos');

drop policy if exists "recepcion visual public read" on storage.objects;
