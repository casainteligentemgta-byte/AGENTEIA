-- Nivel de combustible y declaración de autorización del propietario.

alter table public.ordenes_recepcion
  add column if not exists nivel_combustible text,
  add column if not exists autorizacion_propietario boolean not null default false;

comment on column public.ordenes_recepcion.nivel_combustible is
  'Nivel al ingreso: vacio, 1_4, 1_2, 3_4, lleno';
comment on column public.ordenes_recepcion.autorizacion_propietario is
  'Cliente declara ser propietario o estar autorizado para requerir los trabajos';
