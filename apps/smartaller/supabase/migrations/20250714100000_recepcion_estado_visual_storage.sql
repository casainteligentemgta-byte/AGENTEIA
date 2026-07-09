-- Fotos del estado visual al recibir el vehículo (4 vistas + anotaciones).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recepcion-estado-visual',
  'recepcion-estado-visual',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recepcion visual insert taller" on storage.objects;
create policy "recepcion visual insert taller"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recepcion-estado-visual'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

drop policy if exists "recepcion visual select taller" on storage.objects;
create policy "recepcion visual select taller"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recepcion-estado-visual'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

drop policy if exists "recepcion visual all service role" on storage.objects;
create policy "recepcion visual all service role"
  on storage.objects for all to service_role
  using (bucket_id = 'recepcion-estado-visual')
  with check (bucket_id = 'recepcion-estado-visual');
