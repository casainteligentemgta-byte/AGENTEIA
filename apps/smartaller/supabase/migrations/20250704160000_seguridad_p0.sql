-- P0 seguridad: idempotencia facturas Telegram y RLS más estricto por vehiculo_id

-- Evitar duplicados en reintentos de webhook Telegram
create unique index if not exists idx_mantenimientos_telegram_msg
  on public.mantenimientos (telegram_chat_id, telegram_message_id)
  where telegram_chat_id is not null and telegram_message_id is not null;

-- Lectura historial: solo mantenimientos del vehículo que posee el usuario (no solo por placa)
drop policy if exists "mantenimientos select by owner placa" on public.mantenimientos;
create policy "mantenimientos select by owner vehiculo"
  on public.mantenimientos for select
  to authenticated
  using (
    vehiculo_id in (
      select id from public.vehiculos where user_id = auth.uid()
    )
  );
