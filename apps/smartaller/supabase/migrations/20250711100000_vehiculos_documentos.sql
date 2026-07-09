-- Seriales, cédula del propietario y documentos escaneados (cédula, título de propiedad).

alter table public.vehiculos
  add column if not exists serial_motor text,
  add column if not exists serial_carroceria text,
  add column if not exists cedula_propietario text,
  add column if not exists email_propietario text,
  add column if not exists fecha_nacimiento_propietario date,
  add column if not exists recepcion_inicial jsonb not null default '{}'::jsonb,
  add column if not exists documentos jsonb not null default '{}'::jsonb;

comment on column public.vehiculos.serial_motor is 'Número de serial del motor';
comment on column public.vehiculos.serial_carroceria is 'Número de serial de carrocería / chasis';
comment on column public.vehiculos.cedula_propietario is 'Documento de identidad del propietario';
comment on column public.vehiculos.email_propietario is 'Correo electrónico del propietario';
comment on column public.vehiculos.fecha_nacimiento_propietario is 'Fecha de nacimiento del propietario';
comment on column public.vehiculos.recepcion_inicial is 'Acta de recepción al ingresar el vehículo al taller';
comment on column public.vehiculos.documentos is 'URLs de cédula y título: { cedula?: {url,path}, titulo?: {url,path} }';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehiculos-documentos',
  'vehiculos-documentos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehiculos-docs insert taller" on storage.objects;
create policy "vehiculos-docs insert taller"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vehiculos-documentos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

drop policy if exists "vehiculos-docs select taller" on storage.objects;
create policy "vehiculos-docs select taller"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vehiculos-documentos'
    and (storage.foldername(name))[1] = public.get_my_taller_id()::text
  );

drop policy if exists "vehiculos-docs all service role" on storage.objects;
create policy "vehiculos-docs all service role"
  on storage.objects for all to service_role
  using (bucket_id = 'vehiculos-documentos')
  with check (bucket_id = 'vehiculos-documentos');
