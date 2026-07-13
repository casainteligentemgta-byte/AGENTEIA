-- Acceso público de lectura para URLs getPublicUrl en <img> del dashboard/cliente.
drop policy if exists "recepcion visual public read" on storage.objects;
create policy "recepcion visual public read"
  on storage.objects for select
  using (bucket_id = 'recepcion-estado-visual');

update storage.buckets
set public = true
where id = 'recepcion-estado-visual';
