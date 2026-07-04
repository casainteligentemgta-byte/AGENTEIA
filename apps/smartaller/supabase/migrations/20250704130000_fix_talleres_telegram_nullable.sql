-- Fix: telegram_chat_id debe ser nullable.
-- El taller se crea al iniciar sesión; Telegram se vincula después con /vincular CODIGO.

alter table public.talleres
  alter column telegram_chat_id drop not null;
