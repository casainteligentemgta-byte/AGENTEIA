-- Inventario de repuestos por taller y líneas usadas en cada orden de servicio.

create table if not exists public.repuestos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  nombre text not null,
  sku text,
  unidad text not null default 'und',
  precio_venta numeric(12, 2) not null default 0 check (precio_venta >= 0),
  stock_actual numeric(10, 2) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(10, 2) not null default 0 check (stock_minimo >= 0),
  activo boolean not null default true
);

create index if not exists idx_repuestos_taller on public.repuestos (taller_id);
create index if not exists idx_repuestos_taller_activo on public.repuestos (taller_id, activo);

create table if not exists public.mantenimiento_repuestos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mantenimiento_id uuid not null references public.mantenimientos (id) on delete cascade,
  repuesto_id uuid references public.repuestos (id) on delete set null,
  nombre text not null,
  cantidad numeric(10, 2) not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2) not null default 0 check (precio_unitario >= 0),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0)
);

create index if not exists idx_mantenimiento_repuestos_mant on public.mantenimiento_repuestos (mantenimiento_id);

comment on table public.repuestos is 'Catálogo de repuestos del taller (inventario)';
comment on table public.mantenimiento_repuestos is 'Repuestos consumidos en una orden de servicio';

-- RLS repuestos
alter table public.repuestos enable row level security;

drop policy if exists "repuestos select own taller" on public.repuestos;
create policy "repuestos select own taller"
  on public.repuestos for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos insert own taller" on public.repuestos;
create policy "repuestos insert own taller"
  on public.repuestos for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos update own taller" on public.repuestos;
create policy "repuestos update own taller"
  on public.repuestos for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos delete own taller" on public.repuestos;
create policy "repuestos delete own taller"
  on public.repuestos for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "repuestos all service role" on public.repuestos;
create policy "repuestos all service role"
  on public.repuestos for all to service_role using (true) with check (true);

-- RLS líneas de repuesto
alter table public.mantenimiento_repuestos enable row level security;

drop policy if exists "mantenimiento_repuestos select taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos select taller"
  on public.mantenimiento_repuestos for select to authenticated
  using (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos select owner vehiculo" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos select owner vehiculo"
  on public.mantenimiento_repuestos for select to authenticated
  using (
    mantenimiento_id in (
      select m.id
      from public.mantenimientos m
      join public.vehiculos v on v.id = m.vehiculo_id
      where v.user_id = auth.uid()
    )
  );

drop policy if exists "mantenimiento_repuestos insert taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos insert taller"
  on public.mantenimiento_repuestos for insert to authenticated
  with check (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos delete taller" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos delete taller"
  on public.mantenimiento_repuestos for delete to authenticated
  using (
    mantenimiento_id in (
      select id from public.mantenimientos where taller_id = public.get_my_taller_id()
    )
  );

drop policy if exists "mantenimiento_repuestos all service role" on public.mantenimiento_repuestos;
create policy "mantenimiento_repuestos all service role"
  on public.mantenimiento_repuestos for all to service_role using (true) with check (true);
