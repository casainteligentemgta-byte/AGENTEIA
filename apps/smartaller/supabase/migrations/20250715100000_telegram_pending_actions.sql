-- Estado pendiente del bot de Telegram (ej. esperando foto frontal tras /recepcion)
create table if not exists public.telegram_pending_actions (
  chat_id bigint primary key,
  action text not null,
  created_at timestamptz not null default now()
);

comment on table public.telegram_pending_actions is
  'Acciones pendientes por chat de Telegram (service role únicamente)';

alter table public.telegram_pending_actions enable row level security;

-- Sin políticas para anon/authenticated: solo service role accede
