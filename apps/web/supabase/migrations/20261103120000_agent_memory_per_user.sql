-- Memoria por usuario + cuota diaria del chat.
-- Idempotente: se puede ejecutar varias veces.
--
-- Memorias existentes (seed) quedan con user_id NULL = sistema:
--   legibles por todos, no escribibles por usuarios autenticados.
-- Memorias nuevas del chat llevan user_id = auth.uid().

-- ========== agent_memory: user_id ==========
alter table public.agent_memory
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

comment on column public.agent_memory.user_id is
  'NULL = memoria de sistema (legible por todos). UUID = memoria privada del usuario.';

create index if not exists idx_agent_memory_user_id on public.agent_memory (user_id);

drop policy if exists "Allow read agent_memory" on public.agent_memory;
drop policy if exists "Allow insert agent_memory" on public.agent_memory;
drop policy if exists "memory_select_system_anon" on public.agent_memory;
drop policy if exists "memory_select_own_or_system" on public.agent_memory;
drop policy if exists "memory_insert_own" on public.agent_memory;
drop policy if exists "memory_delete_own" on public.agent_memory;

-- Anon: solo memorias de sistema (health checks, seed).
create policy "memory_select_system_anon"
  on public.agent_memory for select
  to anon
  using (user_id is null);

-- Autenticados: sistema + las suyas. (select auth.uid()) evita initplan por fila.
create policy "memory_select_own_or_system"
  on public.agent_memory for select
  to authenticated
  using (user_id is null or user_id = (select auth.uid()));

-- Solo pueden insertar memorias propias (nunca user_id NULL).
create policy "memory_insert_own"
  on public.agent_memory for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "memory_delete_own"
  on public.agent_memory for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on table public.agent_memory from anon;
grant select on table public.agent_memory to anon;
grant select, insert, delete on table public.agent_memory to authenticated;

-- RPC: SECURITY INVOKER para que RLS aplique. Defensa extra: filtra por auth.uid().
create or replace function public.match_agent_memories(
  query_embedding extensions.vector(1536),
  match_count int default 10
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    agent_memory.id,
    agent_memory.content,
    1 - (agent_memory.embedding <=> query_embedding) as similarity
  from public.agent_memory
  where agent_memory.user_id is null
     or agent_memory.user_id = (select auth.uid())
  order by agent_memory.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

comment on function public.match_agent_memories(extensions.vector, int) is
  'Busca memorias por similitud: sistema (user_id null) + las del usuario actual.';

grant execute on function public.match_agent_memories(extensions.vector, int) to anon, authenticated;

-- ========== chat_usage: tope diario por usuario ==========
create table if not exists public.chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((now() at time zone 'utc')::date),
  message_count int not null default 0 check (message_count >= 0),
  primary key (user_id, usage_date)
);

comment on table public.chat_usage is
  'Contador diario de mensajes de /api/chat por usuario (UTC).';

create index if not exists idx_chat_usage_date on public.chat_usage (usage_date);

alter table public.chat_usage enable row level security;

drop policy if exists "chat_usage_select_own" on public.chat_usage;
drop policy if exists "chat_usage_insert_own" on public.chat_usage;
drop policy if exists "chat_usage_update_own" on public.chat_usage;

create policy "chat_usage_select_own"
  on public.chat_usage for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "chat_usage_insert_own"
  on public.chat_usage for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "chat_usage_update_own"
  on public.chat_usage for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.chat_usage from anon;
grant select, insert, update on table public.chat_usage to authenticated;

-- Incremento atómico. p_daily_limit <= 0 = ilimitado (no incrementa).
create or replace function public.consume_chat_quota(p_daily_limit int)
returns table (
  allowed boolean,
  current_count int,
  daily_limit int
)
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_date date := ((now() at time zone 'utc')::date);
  v_count int;
begin
  if v_user is null then
    return query select false, 0, greatest(coalesce(p_daily_limit, 0), 0);
    return;
  end if;

  if p_daily_limit is null or p_daily_limit <= 0 then
    select u.message_count into v_count
    from public.chat_usage u
    where u.user_id = v_user and u.usage_date = v_date;
    return query select true, coalesce(v_count, 0), 0;
    return;
  end if;

  insert into public.chat_usage as u (user_id, usage_date, message_count)
  values (v_user, v_date, 1)
  on conflict (user_id, usage_date)
  do update set message_count = u.message_count + 1
  where u.message_count < p_daily_limit
  returning u.message_count into v_count;

  if v_count is null then
    select u.message_count into v_count
    from public.chat_usage u
    where u.user_id = v_user and u.usage_date = v_date;
    return query select false, coalesce(v_count, p_daily_limit), p_daily_limit;
    return;
  end if;

  return query select true, v_count, p_daily_limit;
end;
$$;

comment on function public.consume_chat_quota(int) is
  'Consume 1 mensaje del tope diario del usuario actual. allowed=false si se superó el límite.';

revoke all on function public.consume_chat_quota(int) from public, anon;
grant execute on function public.consume_chat_quota(int) to authenticated;
