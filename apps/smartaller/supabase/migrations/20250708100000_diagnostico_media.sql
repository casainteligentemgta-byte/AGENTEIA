-- Fotos y videos de diagnóstico (Storage + referencias en mantenimientos.detalle_revision.media)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diagnosticos',
  'diagnosticos',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Taller: subir a su carpeta {taller_id}/{mantenimiento_id}/*
drop policy if exists "diagnosticos insert taller" on storage.objects;
create policy "diagnosticos insert taller"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'diagnosticos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
    and exists (
      select 1
      from public.mantenimientos m
      where m.id::text = (storage.foldername(name))[2]
        and m.taller_id = public.get_my_taller_id()
    )
  );

-- Taller: leer sus archivos
drop policy if exists "diagnosticos select taller" on storage.objects;
create policy "diagnosticos select taller"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'diagnosticos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

-- Dueño del vehículo: leer diagnósticos de sus mantenimientos
drop policy if exists "diagnosticos select owner vehiculo" on storage.objects;
create policy "diagnosticos select owner vehiculo"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'diagnosticos'
    and exists (
      select 1
      from public.mantenimientos m
      join public.vehiculos v on v.id = m.vehiculo_id
      where m.id::text = (storage.foldername(name))[2]
        and v.user_id = auth.uid()
    )
  );

-- Service role (webhook / scripts)
drop policy if exists "diagnosticos all service role" on storage.objects;
create policy "diagnosticos all service role"
  on storage.objects for all to service_role
  using (bucket_id = 'diagnosticos')
  with check (bucket_id = 'diagnosticos');

comment on table public.mantenimientos is 'Incluye detalle_revision.media[] con URLs de fotos/videos en bucket diagnosticos';
