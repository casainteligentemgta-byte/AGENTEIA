-- Copiar y pegar en Supabase → SQL Editor. Independiente del código de la app.
-- Origen: supabase/migrations/20261113010000_security_advisors.sql
-- No cambia buckets ni Storage.

-- 1) SECURITY DEFINER: anon no debe poder llamarlas por /rest/v1/rpc.
revoke execute on function public.get_my_taller_id() from public, anon;
grant execute on function public.get_my_taller_id() to authenticated, service_role;

revoke execute on function public.usuario_suscripcion_activa() from public, anon;
grant execute on function public.usuario_suscripcion_activa() to authenticated, service_role;

revoke execute on function public.usuario_tiene_vehiculo_taller() from public, anon;
grant execute on function public.usuario_tiene_vehiculo_taller() to authenticated, service_role;

revoke execute on function public.usuario_es_dueno_placa_vehiculo(uuid) from public, anon;
grant execute on function public.usuario_es_dueno_placa_vehiculo(uuid) to authenticated, service_role;

revoke execute on function public.count_recordatorios_pendientes_placa(text) from public, anon;
grant execute on function public.count_recordatorios_pendientes_placa(text) to authenticated, service_role;

-- 2) search_path fijo en el hook de JWT (si existe en este proyecto).
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'custom_access_token_hook'
      and pg_get_function_identity_arguments(p.oid) = 'event jsonb'
  ) then
    execute 'alter function public.custom_access_token_hook(jsonb) set search_path = public';
  end if;
end
$$;

-- 3) Políticas explícitas en tablas Telegram (RLS on, sin policies).
do $$
begin
  if to_regclass('public.telegram_pending_actions') is not null then
    execute 'drop policy if exists "telegram_pending_actions service role" on public.telegram_pending_actions';
    execute $p$
      create policy "telegram_pending_actions service role"
        on public.telegram_pending_actions
        for all
        to service_role
        using (true)
        with check (true)
    $p$;
  end if;

  if to_regclass('public.telegram_recepcion_sesiones') is not null then
    execute 'drop policy if exists "telegram_recepcion_sesiones service role" on public.telegram_recepcion_sesiones';
    execute $p$
      create policy "telegram_recepcion_sesiones service role"
        on public.telegram_recepcion_sesiones
        for all
        to service_role
        using (true)
        with check (true)
    $p$;
  end if;
end
$$;

-- 4) Índices en FKs sin cubrir.
do $$
declare
  spec text;
  tbl text;
  idx text;
  cols text;
begin
  foreach spec in array array[
    'biblioteca_legal_documentos|idx_biblioteca_legal_documentos_uploaded_by|uploaded_by',
    'bikes|idx_bikes_shop_id|shop_id',
    'maintenance_protocols|idx_maintenance_protocols_shop_id|shop_id',
    'mantenimiento_repuestos|idx_mantenimiento_repuestos_repuesto_id|repuesto_id',
    'mantenimientos|idx_mantenimientos_taller_id|taller_id',
    'mantenimientos|idx_mantenimientos_vehiculo_id|vehiculo_id',
    'orden_recepcion_checklist|idx_orden_recepcion_checklist_item_id|item_id',
    'ordenes_recepcion|idx_ordenes_recepcion_created_by|created_by',
    'portal_accesos|idx_portal_accesos_aislado_por|aislado_por',
    'recordatorios|idx_recordatorios_mantenimiento_id|mantenimiento_id',
    'talleres|idx_talleres_aislado_por|aislado_por',
    'telegram_recepcion_sesiones|idx_telegram_recepcion_sesiones_taller|taller_id',
    'vehiculo_compartidos|idx_vehiculo_compartidos_shared_by|shared_by',
    'vehiculos|idx_vehiculos_taller_id|taller_id',
    'vehiculos|idx_vehiculos_ultima_orden_recepcion_id|ultima_orden_recepcion_id',
    'nfc_tags|idx_nfc_tags_vehicle_id|vehicle_id',
    'vehicle_documents|idx_vehicle_documents_vehicle_id|vehicle_id',
    'vehicles|idx_vehicles_owner_id|owner_id'
  ]
  loop
    tbl := split_part(spec, '|', 1);
    idx := split_part(spec, '|', 2);
    cols := split_part(spec, '|', 3);
    if to_regclass(format('public.%s', tbl)) is not null then
      execute format('create index if not exists %I on public.%I (%s)', idx, tbl, cols);
    end if;
  end loop;
end
$$;

-- 5) Índice duplicado en nfc_stickers.token.
drop index if exists public.idx_nfc_stickers_token;
