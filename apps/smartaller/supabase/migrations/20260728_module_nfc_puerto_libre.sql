-- Módulo NFC Puerto Libre (aislado).
-- Stickers NFC/QR con token público (/v/[token]) y PIN en el vehículo (bcrypt).
-- RLS: acceso autenticado solo al taller propio; lectura pública vía service role en servidor.

-- PIN de verificación NFC en el vehículo (Smart Taller).
alter table public.vehiculos
  add column if not exists pin_hash text;

comment on column public.vehiculos.pin_hash is
  'Hash bcrypt del PIN para desbloquear ficha vía sticker NFC Puerto Libre';

create table if not exists public.nfc_stickers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  vehiculo_id uuid references public.vehiculos (id) on delete set null,
  token text not null unique,
  etiqueta text,
  placa text,
  marca text,
  modelo text,
  color text,
  nombre_titular text,
  -- Fallback si el sticker aún no está vinculado a un vehículo con pin_hash.
  pin_hash text,
  activo boolean not null default true,
  notas text,
  last_verified_at timestamptz,
  last_scanned_at timestamptz,
  constraint nfc_stickers_token_len check (char_length(token) >= 16 and char_length(token) <= 64)
);

create index if not exists idx_nfc_stickers_taller on public.nfc_stickers (taller_id);
create index if not exists idx_nfc_stickers_taller_activo on public.nfc_stickers (taller_id, activo);
create unique index if not exists idx_nfc_stickers_token on public.nfc_stickers (token);
create index if not exists idx_nfc_stickers_vehiculo on public.nfc_stickers (vehiculo_id)
  where vehiculo_id is not null;

comment on table public.nfc_stickers is
  'Stickers NFC Puerto Libre: token público /v/{token}, vínculo a vehiculos, scoped por taller';

alter table public.nfc_stickers enable row level security;

drop policy if exists "nfc_stickers select own taller" on public.nfc_stickers;
create policy "nfc_stickers select own taller"
  on public.nfc_stickers for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "nfc_stickers insert own taller" on public.nfc_stickers;
create policy "nfc_stickers insert own taller"
  on public.nfc_stickers for insert to authenticated
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "nfc_stickers update own taller" on public.nfc_stickers;
create policy "nfc_stickers update own taller"
  on public.nfc_stickers for update to authenticated
  using (taller_id = public.get_my_taller_id())
  with check (taller_id = public.get_my_taller_id());

drop policy if exists "nfc_stickers delete own taller" on public.nfc_stickers;
create policy "nfc_stickers delete own taller"
  on public.nfc_stickers for delete to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "nfc_stickers all service role" on public.nfc_stickers;
create policy "nfc_stickers all service role"
  on public.nfc_stickers for all to service_role
  using (true)
  with check (true);
