-- Orden de recepción / inspección al ingreso del vehículo al taller.
-- Mapea el formato en papel: propietario, vehículo, checklist A/B/C, daños visuales y firmas.
--
-- Relación con datos existentes:
--   vehiculos.nombre_cliente / telefono_cliente  → ordenes_recepcion.cliente_*
--   vehiculos.placa, modelo, color, serial_carroceria (chasis), kilometraje_ultimo
--   vehiculos.recepcion_inicial (jsonb legacy)   → migrar a ordenes_recepcion cuando aplique

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

create type public.recepcion_checklist_seccion as enum (
  'interior_electrico',
  'interior_accesorios',
  'bajo_capot',
  'parte_trasera_exterior'
);

create type public.recepcion_checklist_valor as enum (
  'presente',
  'ausente',
  'bueno',
  'regular',
  'malo',
  'no_aplica'
);

create type public.recepcion_tipo_dano as enum (
  'rayado',
  'falta_pieza',
  'abolladura',
  'roto'
);

create type public.recepcion_vista_vehiculo as enum (
  'superior',
  'lateral_izquierdo',
  'lateral_derecho',
  'frontal',
  'trasero'
);

-- ---------------------------------------------------------------------------
-- Catálogo maestro del checklist (seed al final)
-- ---------------------------------------------------------------------------

create table if not exists public.recepcion_checklist_catalog (
  id text primary key,
  seccion public.recepcion_checklist_seccion not null,
  subseccion text,
  etiqueta text not null,
  orden smallint not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.recepcion_checklist_catalog is
  'Ítems del checklist de inspección al ingreso (formato taller en papel)';

-- ---------------------------------------------------------------------------
-- Orden de recepción (cabecera)
-- ---------------------------------------------------------------------------

create table if not exists public.ordenes_recepcion (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  taller_id uuid not null references public.talleres (id) on delete cascade,
  vehiculo_id uuid not null references public.vehiculos (id) on delete cascade,
  mantenimiento_id uuid references public.mantenimientos (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,

  -- 1. Información del propietario (snapshot al momento de la recepción)
  cliente_nombre text not null,
  cliente_telefono text not null,

  -- 1. Datos del vehículo recolectados en la orden
  placa text not null,
  modelo text,
  color text,
  chasis text,
  kilometraje integer check (kilometraje is null or kilometraje >= 0),

  fecha_ingreso date not null default current_date,
  hora_ingreso time,

  -- Estado de ingreso
  llego_grua boolean not null default false,
  vehiculo_sucio boolean not null default false,
  estado_ingreso_notas text,

  -- 3. Información adicional
  motivo_visita text,

  -- Validación / firmas
  firma_cliente text,
  firma_asesor text,
  firmado_cliente_at timestamptz,
  firmado_asesor_at timestamptz,

  -- Metadatos del esquema gráfico (dimensiones, versión del SVG, etc.)
  esquema_danos_meta jsonb not null default '{}'::jsonb,

  constraint ordenes_recepcion_firmas_check check (
    (firma_cliente is null and firmado_cliente_at is null)
    or (firma_cliente is not null and firmado_cliente_at is not null)
  ),
  constraint ordenes_recepcion_firma_asesor_check check (
    (firma_asesor is null and firmado_asesor_at is null)
    or (firma_asesor is not null and firmado_asesor_at is not null)
  )
);

create index if not exists idx_ordenes_recepcion_taller
  on public.ordenes_recepcion (taller_id, created_at desc);

create index if not exists idx_ordenes_recepcion_vehiculo
  on public.ordenes_recepcion (vehiculo_id, created_at desc);

create index if not exists idx_ordenes_recepcion_mantenimiento
  on public.ordenes_recepcion (mantenimiento_id)
  where mantenimiento_id is not null;

comment on table public.ordenes_recepcion is
  'Orden de servicio / acta de recepción al ingresar el vehículo al taller';
comment on column public.ordenes_recepcion.chasis is
  'Número de chasis; en vehiculos suele almacenarse como serial_carroceria';
comment on column public.ordenes_recepcion.llego_grua is
  '¿El vehículo llegó en grúa?';
comment on column public.ordenes_recepcion.vehiculo_sucio is
  '¿El vehículo ingresó sucio?';
comment on column public.ordenes_recepcion.motivo_visita is
  'Trabajo solicitado, ej. Rev. 15000 kms';
comment on column public.ordenes_recepcion.esquema_danos_meta is
  'Metadatos del diagrama; las marcas van en orden_recepcion_danos';

-- ---------------------------------------------------------------------------
-- Respuestas del checklist (2. Inspección técnica A / B / C)
-- ---------------------------------------------------------------------------

create table if not exists public.orden_recepcion_checklist (
  id uuid primary key default gen_random_uuid(),
  orden_recepcion_id uuid not null references public.ordenes_recepcion (id) on delete cascade,
  item_id text not null references public.recepcion_checklist_catalog (id) on delete restrict,
  valor public.recepcion_checklist_valor not null default 'no_aplica',
  notas text,
  created_at timestamptz not null default now(),
  unique (orden_recepcion_id, item_id)
);

create index if not exists idx_orden_recepcion_checklist_orden
  on public.orden_recepcion_checklist (orden_recepcion_id);

comment on table public.orden_recepcion_checklist is
  'Respuesta por ítem del checklist para una orden de recepción';

-- ---------------------------------------------------------------------------
-- Daños visuales sobre el esquema del vehículo (3. Estado visual)
-- ---------------------------------------------------------------------------

create table if not exists public.orden_recepcion_danos (
  id uuid primary key default gen_random_uuid(),
  orden_recepcion_id uuid not null references public.ordenes_recepcion (id) on delete cascade,
  vista public.recepcion_vista_vehiculo not null default 'superior',
  zona_id text not null,
  tipo public.recepcion_tipo_dano not null,
  posicion_x numeric(5, 2) not null check (posicion_x >= 0 and posicion_x <= 100),
  posicion_y numeric(5, 2) not null check (posicion_y >= 0 and posicion_y <= 100),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orden_recepcion_danos_orden
  on public.orden_recepcion_danos (orden_recepcion_id);

comment on table public.orden_recepcion_danos is
  'Marcas sobre el diagrama del vehículo: rayado, falta pieza (X), abolladura (O), roto (Δ)';
comment on column public.orden_recepcion_danos.zona_id is
  'Región del vehículo, ej. capo, puerta_del_izq, parachoques_trasero';
comment on column public.orden_recepcion_danos.posicion_x is
  'Coordenada X relativa 0–100 % dentro de la vista';
comment on column public.orden_recepcion_danos.posicion_y is
  'Coordenada Y relativa 0–100 % dentro de la vista';

-- ---------------------------------------------------------------------------
-- Catálogo de zonas del diagrama (referencia para UI)
-- ---------------------------------------------------------------------------

create table if not exists public.recepcion_zona_vehiculo (
  id text primary key,
  vista public.recepcion_vista_vehiculo not null,
  etiqueta text not null,
  orden smallint not null default 0
);

comment on table public.recepcion_zona_vehiculo is
  'Zonas clicables del esquema gráfico del vehículo para marcar daños';

-- ---------------------------------------------------------------------------
-- Vínculo opcional en vehículos (última recepción)
-- ---------------------------------------------------------------------------

alter table public.vehiculos
  add column if not exists ultima_orden_recepcion_id uuid
    references public.ordenes_recepcion (id) on delete set null;

comment on column public.vehiculos.ultima_orden_recepcion_id is
  'Última orden de recepción formal registrada para este vehículo';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.recepcion_checklist_catalog enable row level security;
alter table public.recepcion_zona_vehiculo enable row level security;
alter table public.ordenes_recepcion enable row level security;
alter table public.orden_recepcion_checklist enable row level security;
alter table public.orden_recepcion_danos enable row level security;

-- Catálogos: lectura para autenticados (datos de referencia)
drop policy if exists "recepcion catalog select authenticated" on public.recepcion_checklist_catalog;
create policy "recepcion catalog select authenticated"
  on public.recepcion_checklist_catalog for select to authenticated
  using (activo = true);

drop policy if exists "recepcion zonas select authenticated" on public.recepcion_zona_vehiculo;
create policy "recepcion zonas select authenticated"
  on public.recepcion_zona_vehiculo for select to authenticated
  using (true);

drop policy if exists "ordenes recepcion select taller" on public.ordenes_recepcion;
create policy "ordenes recepcion select taller"
  on public.ordenes_recepcion for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "ordenes recepcion insert taller" on public.ordenes_recepcion;
create policy "ordenes recepcion insert taller"
  on public.ordenes_recepcion for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "ordenes recepcion update taller" on public.ordenes_recepcion;
create policy "ordenes recepcion update taller"
  on public.ordenes_recepcion for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "ordenes recepcion all service role" on public.ordenes_recepcion;
create policy "ordenes recepcion all service role"
  on public.ordenes_recepcion for all to service_role
  using (true) with check (true);

drop policy if exists "orden checklist select taller" on public.orden_recepcion_checklist;
create policy "orden checklist select taller"
  on public.orden_recepcion_checklist for select to authenticated
  using (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden checklist insert taller" on public.orden_recepcion_checklist;
create policy "orden checklist insert taller"
  on public.orden_recepcion_checklist for insert to authenticated
  with check (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden checklist update taller" on public.orden_recepcion_checklist;
create policy "orden checklist update taller"
  on public.orden_recepcion_checklist for update to authenticated
  using (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  )
  with check (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden checklist all service role" on public.orden_recepcion_checklist;
create policy "orden checklist all service role"
  on public.orden_recepcion_checklist for all to service_role
  using (true) with check (true);

drop policy if exists "orden danos select taller" on public.orden_recepcion_danos;
create policy "orden danos select taller"
  on public.orden_recepcion_danos for select to authenticated
  using (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden danos insert taller" on public.orden_recepcion_danos;
create policy "orden danos insert taller"
  on public.orden_recepcion_danos for insert to authenticated
  with check (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden danos update taller" on public.orden_recepcion_danos;
create policy "orden danos update taller"
  on public.orden_recepcion_danos for update to authenticated
  using (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  )
  with check (
    orden_recepcion_id in (
      select id from public.ordenes_recepcion where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "orden danos all service role" on public.orden_recepcion_danos;
create policy "orden danos all service role"
  on public.orden_recepcion_danos for all to service_role
  using (true) with check (true);

drop policy if exists "recepcion catalog all service role" on public.recepcion_checklist_catalog;
create policy "recepcion catalog all service role"
  on public.recepcion_checklist_catalog for all to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed: checklist A — Interior eléctrico
-- ---------------------------------------------------------------------------

insert into public.recepcion_checklist_catalog (id, seccion, subseccion, etiqueta, orden) values
  ('int_luces_interiores', 'interior_electrico', 'Sistemas eléctricos', 'Luces interiores', 10),
  ('int_indicadores', 'interior_electrico', 'Sistemas eléctricos', 'Indicadores', 20),
  ('int_pito_bocinas', 'interior_electrico', 'Sistemas eléctricos', 'Pito de bocinas', 30),
  ('int_aire_acondicionado', 'interior_electrico', 'Sistemas eléctricos', 'Aire acondicionado', 40),
  ('int_rejillas_ac', 'interior_electrico', 'Sistemas eléctricos', 'Rejillas a/c', 50),
  ('int_func_cristales', 'interior_electrico', 'Sistemas eléctricos', 'Funcionamiento de cristales', 60),
  ('int_switch_cristales', 'interior_electrico', 'Sistemas eléctricos', 'Switch de cristales', 70),
  ('int_radio_bocinas', 'interior_electrico', 'Sistemas eléctricos', 'Radio / bocinas', 80),
  ('int_cd_charger', 'interior_electrico', 'Sistemas eléctricos', 'CD charger', 90),
  ('int_seguros', 'interior_electrico', 'Sistemas eléctricos', 'Funcionamiento de seguros', 100)
on conflict (id) do update set
  seccion = excluded.seccion,
  subseccion = excluded.subseccion,
  etiqueta = excluded.etiqueta,
  orden = excluded.orden;

-- Seed: checklist A — Accesorios y acabados
insert into public.recepcion_checklist_catalog (id, seccion, subseccion, etiqueta, orden) values
  ('int_tapasol', 'interior_accesorios', 'Accesorios y acabados', 'Tapasol', 10),
  ('int_beeper', 'interior_accesorios', 'Accesorios y acabados', 'Beeper', 20),
  ('int_porta_vasos', 'interior_accesorios', 'Accesorios y acabados', 'Porta vasos', 30),
  ('int_encendedor', 'interior_accesorios', 'Accesorios y acabados', 'Encendedor', 40),
  ('int_tapa_consola', 'interior_accesorios', 'Accesorios y acabados', 'Tapa consola central', 50),
  ('int_gaveta_ceniceros', 'interior_accesorios', 'Accesorios y acabados', 'Gaveta ceniceros', 60),
  ('int_tapizados_asientos', 'interior_accesorios', 'Accesorios y acabados', 'Tapizados asientos', 70),
  ('int_molduras', 'interior_accesorios', 'Accesorios y acabados', 'Molduras', 80),
  ('int_alfombras', 'interior_accesorios', 'Accesorios y acabados', 'Alfombras', 90),
  ('int_sunroof', 'interior_accesorios', 'Accesorios y acabados', 'Funcionamiento de sunroof', 100)
on conflict (id) do update set
  seccion = excluded.seccion,
  subseccion = excluded.subseccion,
  etiqueta = excluded.etiqueta,
  orden = excluded.orden;

-- Seed: checklist B — Bajo el capot
insert into public.recepcion_checklist_catalog (id, seccion, subseccion, etiqueta, orden) values
  ('capot_varilla_aceite', 'bajo_capot', 'Niveles y componentes', 'Varilla de aceite', 10),
  ('capot_varilla_atf', 'bajo_capot', 'Niveles y componentes', 'Varilla ATF', 20),
  ('capot_tapon_aceite_motor', 'bajo_capot', 'Niveles y componentes', 'Tapón aceite motor', 30),
  ('capot_tapa_bomba_direccion', 'bajo_capot', 'Niveles y componentes', 'Tapa bomba de dirección', 40),
  ('capot_tapon_coolant', 'bajo_capot', 'Niveles y componentes', 'Tapón del coolant', 50),
  ('capot_tapa_radiador', 'bajo_capot', 'Niveles y componentes', 'Tapa de radiador', 60),
  ('capot_cover_polo_bateria', 'bajo_capot', 'Niveles y componentes', 'Cover polo batería', 70),
  ('capot_cover_tapa_motor', 'bajo_capot', 'Niveles y componentes', 'Cover tapa de motor', 80),
  ('capot_baterias', 'bajo_capot', 'Niveles y componentes', 'Baterías', 90)
on conflict (id) do update set
  seccion = excluded.seccion,
  subseccion = excluded.subseccion,
  etiqueta = excluded.etiqueta,
  orden = excluded.orden;

-- Seed: checklist C — Parte trasera / exterior
insert into public.recepcion_checklist_catalog (id, seccion, subseccion, etiqueta, orden) values
  ('ext_tapa_bumper', 'parte_trasera_exterior', 'Componentes', 'Tapa cobertura bumper', 10),
  ('ext_tapa_bocina_centro_aro', 'parte_trasera_exterior', 'Componentes', 'Tapa bocina / centro aro', 20),
  ('ext_cover_goma_repuesto', 'parte_trasera_exterior', 'Componentes', 'Cover goma de repuesto', 30),
  ('ext_goma_repuesto', 'parte_trasera_exterior', 'Componentes', 'Goma de repuesto', 40),
  ('ext_candado_rueda', 'parte_trasera_exterior', 'Componentes', 'Candado de rueda', 50),
  ('ext_gato', 'parte_trasera_exterior', 'Componentes', 'Gato', 60),
  ('ext_herramientas', 'parte_trasera_exterior', 'Componentes', 'Herramientas', 70),
  ('ext_triangulo', 'parte_trasera_exterior', 'Componentes', 'Triángulo', 80),
  ('ext_antena', 'parte_trasera_exterior', 'Componentes', 'Antena', 90),
  ('ext_guardafango_tras_rh', 'parte_trasera_exterior', 'Estado', 'Guardafango trasero RH', 100),
  ('ext_guardafango_tras_lh', 'parte_trasera_exterior', 'Estado', 'Guardafango trasero LH', 110),
  ('ext_radio_am_fm_cd', 'parte_trasera_exterior', 'Estado', 'Sistema de radio AM/FM/CD', 120)
on conflict (id) do update set
  seccion = excluded.seccion,
  subseccion = excluded.subseccion,
  etiqueta = excluded.etiqueta,
  orden = excluded.orden;

-- Seed: zonas del diagrama de daños (vista superior + laterales)
insert into public.recepcion_zona_vehiculo (id, vista, etiqueta, orden) values
  ('capo', 'superior', 'Capó', 10),
  ('techo', 'superior', 'Techo', 20),
  ('maletero', 'superior', 'Maletero / tapa baúl', 30),
  ('parachoques_del', 'frontal', 'Parachoques delantero', 10),
  ('parabrisas', 'frontal', 'Parabrisas', 20),
  ('farola_izq', 'frontal', 'Farola izquierda', 30),
  ('farola_der', 'frontal', 'Farola derecha', 40),
  ('parachoques_tras', 'trasero', 'Parachoques trasero', 10),
  ('luneta', 'trasero', 'Luneta', 20),
  ('stop_izq', 'trasero', 'Stop izquierdo', 30),
  ('stop_der', 'trasero', 'Stop derecho', 40),
  ('puerta_del_izq', 'lateral_izquierdo', 'Puerta delantera izquierda', 10),
  ('puerta_tras_izq', 'lateral_izquierdo', 'Puerta trasera izquierda', 20),
  ('guardafango_del_izq', 'lateral_izquierdo', 'Guardafango delantero izq.', 30),
  ('guardafango_tras_izq', 'lateral_izquierdo', 'Guardafango trasero izq.', 40),
  ('puerta_del_der', 'lateral_derecho', 'Puerta delantera derecha', 10),
  ('puerta_tras_der', 'lateral_derecho', 'Puerta trasera derecha', 20),
  ('guardafango_del_der', 'lateral_derecho', 'Guardafango delantero der.', 30),
  ('guardafango_tras_der', 'lateral_derecho', 'Guardafango trasero der.', 40)
on conflict (id) do update set
  vista = excluded.vista,
  etiqueta = excluded.etiqueta,
  orden = excluded.orden;
