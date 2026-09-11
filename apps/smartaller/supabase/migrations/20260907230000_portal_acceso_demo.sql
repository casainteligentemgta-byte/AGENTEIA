-- Acceso demo temporal: usuario/clave compartibles con caducidad y cierre.

alter table public.portal_accesos
  add column if not exists es_demo boolean not null default false,
  add column if not exists demo_expires_at timestamptz,
  add column if not exists demo_closed_at timestamptz;

comment on column public.portal_accesos.es_demo is
  'Si true, el acceso es una cuenta demo temporal creada por el máster.';

comment on column public.portal_accesos.demo_expires_at is
  'Caducidad del acceso demo. Tras esa fecha el usuario no debe entrar.';

comment on column public.portal_accesos.demo_closed_at is
  'Momento en que el máster cerró la sesión/demo de forma anticipada.';

create index if not exists idx_portal_accesos_es_demo
  on public.portal_accesos (es_demo)
  where es_demo = true;

create index if not exists idx_portal_accesos_demo_expires_at
  on public.portal_accesos (demo_expires_at)
  where es_demo = true and demo_expires_at is not null;
