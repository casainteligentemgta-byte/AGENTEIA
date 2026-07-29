-- SmartTaller — Seed demo SmartBike (OPCIONAL)
-- Requiere: parche jul5-jul10 o setup-completo actualizado
-- Usa el primer usuario de auth.users

-- Seed SmartBike (demo)
-- 1. Ejecuta tras 20250707100000_smartbike.sql
-- 2. Reemplaza :USER_ID por el UUID de auth.users del ciclista de prueba

-- Taller de confianza
insert into public.shops (id, name, logo_url, address, contact_phone)
values (
  'a1111111-1111-4111-8111-111111111111',
  'Ciclo Norte',
  'https://ui-avatars.com/api/?name=Ciclo+Norte&background=0d9488&color=fff&size=128',
  'Calle 100 #15-20, Bogotá',
  '+57 300 123 4567'
)
on conflict (id) do nothing;

-- Bicicleta demo (sustituir user_id)
-- insert into public.bikes (
--   id, user_id, shop_id, brand, model, frame_serial, color, size, material, status
-- ) values (
--   'b2222222-2222-4222-8222-222222222222',
--   ':USER_ID',
--   'a1111111-1111-4111-8111-111111111111',
--   'Trek',
--   'Domane SL 5',
--   'TRK-DOM-2024-001',
--   'negro mate',
--   '54',
--   'carbono',
--   'active'
-- );

-- Componentes con desgaste variado (descomentar tras insertar la bici)
-- insert into public.bike_components (bike_id, component_type, brand_model, km_accumulated, km_limit, status)
-- values
--   ('b2222222-2222-4222-8222-222222222222', 'cadena', 'Shimano CN-HG71', 2400, 3000, 'yellow'),
--   ('b2222222-2222-4222-8222-222222222222', 'pastillas_freno', 'SRAM HRD', 1800, 2000, 'red'),
--   ('b2222222-2222-4222-8222-222222222222', 'neumatico', 'Continental GP5000', 1200, 5000, 'green'),
--   ('b2222222-2222-4222-8222-222222222222', 'suspension', 'Fox 32 Rhythm', 800, 5000, 'green'),
--   ('b2222222-2222-4222-8222-222222222222', 'rodamientos', 'CeramicSpeed BB', 1500, 8000, 'green')
-- on conflict (bike_id, component_type) do nothing;

-- Atajo: crea bici + componentes para el primer usuario de auth (solo dev)
do $$
declare
  v_user_id uuid;
  v_bike_id uuid := 'b2222222-2222-4222-8222-222222222222';
  v_shop_id uuid := 'a1111111-1111-4111-8111-111111111111';
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise notice 'No hay usuarios en auth.users — crea uno antes del seed';
    return;
  end if;

  insert into public.bikes (
    id, user_id, vehiculo_id, shop_id, brand, model, frame_serial, color, size, material, status
  ) values (
    v_bike_id, v_user_id, null, v_shop_id,
    'Trek', 'Domane SL 5', 'TRK-DOM-2024-001',
    'negro mate', '54', 'carbono', 'active'
  )
  on conflict (user_id, frame_serial) do update set shop_id = excluded.shop_id
  returning id into v_bike_id;

  insert into public.vehiculos (
    user_id, tipo_vehiculo, placa, marca, modelo, color,
    unidad_odometro, kilometraje_ultimo, telegram_chat_id, updated_at
  ) values (
    v_user_id, 'bicicleta', 'TRK-DOM-2024-001',
    'Trek', 'Domane SL 5', 'negro mate',
    'km', 0, null, now()
  )
  on conflict (placa, user_id) where user_id is not null do nothing;

  update public.bikes b
  set vehiculo_id = v.id
  from public.vehiculos v
  where b.id = v_bike_id
    and v.user_id = v_user_id
    and v.placa = 'TRK-DOM-2024-001'
    and b.vehiculo_id is null;

  insert into public.bike_components (bike_id, component_type, brand_model, km_accumulated, km_limit, status)
  values
    (v_bike_id, 'cadena', 'Shimano CN-HG71', 2400, 3000, 'yellow'),
    (v_bike_id, 'pastillas_freno', 'SRAM HRD', 1800, 2000, 'red'),
    (v_bike_id, 'neumatico', 'Continental GP5000', 1200, 5000, 'green'),
    (v_bike_id, 'suspension', 'Fox 32 Rhythm', 800, 5000, 'green'),
    (v_bike_id, 'rodamientos', 'CeramicSpeed BB', 1500, 8000, 'green')
  on conflict (bike_id, component_type) do update set
    km_accumulated = excluded.km_accumulated,
    km_limit = excluded.km_limit,
    status = excluded.status;
end $$;
