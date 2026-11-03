-- AGENTE IA — Setup completo para Supabase SQL Editor
-- Ejecutar en: Supabase Dashboard → SQL → New query → Pegar todo → Run
-- Orden: profile → missions → memory → profile RLS

-- ========== 1. agent_profile ==========
create table if not exists public.agent_profile (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tags text[] not null default '{}'
);

insert into public.agent_profile (tags)
select array['contexto', 'memoria', 'asistente']
where not exists (select 1 from public.agent_profile limit 1);

-- ========== 2. agent_missions ==========
create table if not exists public.agent_missions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  title text not null,
  description text,
  reward_xp int not null default 10,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  due_date date
);

create index if not exists idx_agent_missions_user_status on public.agent_missions (user_id, status);
create index if not exists idx_agent_missions_due_date on public.agent_missions (due_date);

alter table public.agent_missions enable row level security;

drop policy if exists "Allow read agent_missions" on public.agent_missions;
drop policy if exists "Allow insert agent_missions" on public.agent_missions;
drop policy if exists "Allow update agent_missions" on public.agent_missions;
drop policy if exists "missions_select_own" on public.agent_missions;
drop policy if exists "missions_insert_own" on public.agent_missions;
drop policy if exists "missions_update_own" on public.agent_missions;

-- RLS por usuario (D7): cada uno ve/edita solo sus misiones
create policy "missions_select_own"
  on public.agent_missions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "missions_insert_own"
  on public.agent_missions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "missions_update_own"
  on public.agent_missions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========== 3. agent_memory + pgvector (por usuario) ==========
create extension if not exists vector with schema extensions;

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  embedding extensions.vector(1536) not null,
  user_id uuid references auth.users (id) on delete cascade
);

comment on column public.agent_memory.user_id is
  'NULL = memoria de sistema (legible por todos). UUID = memoria privada del usuario.';

create index if not exists idx_agent_memory_user_id on public.agent_memory (user_id);

alter table public.agent_memory enable row level security;

drop policy if exists "Allow read agent_memory" on public.agent_memory;
drop policy if exists "Allow insert agent_memory" on public.agent_memory;
drop policy if exists "memory_select_system_anon" on public.agent_memory;
drop policy if exists "memory_select_own_or_system" on public.agent_memory;
drop policy if exists "memory_insert_own" on public.agent_memory;
drop policy if exists "memory_delete_own" on public.agent_memory;

create policy "memory_select_system_anon"
  on public.agent_memory for select
  to anon
  using (user_id is null);

create policy "memory_select_own_or_system"
  on public.agent_memory for select
  to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy "memory_insert_own"
  on public.agent_memory for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "memory_delete_own"
  on public.agent_memory for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.match_agent_memories(
  query_embedding extensions.vector(1536),
  match_count int default 10
)
returns table (id uuid, content text, similarity float)
language sql
stable
set search_path = public, extensions
as $$
  select agent_memory.id, agent_memory.content,
    1 - (agent_memory.embedding <=> query_embedding) as similarity
  from public.agent_memory
  where agent_memory.user_id is null
     or agent_memory.user_id = (select auth.uid())
  order by agent_memory.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

-- ========== 3b. chat_usage (tope diario /api/chat) ==========
create table if not exists public.chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default ((now() at time zone 'utc')::date),
  message_count int not null default 0 check (message_count >= 0),
  primary key (user_id, usage_date)
);

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

create or replace function public.consume_chat_quota(p_daily_limit int)
returns table (allowed boolean, current_count int, daily_limit int)
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

revoke all on function public.consume_chat_quota(int) from public, anon;
grant execute on function public.consume_chat_quota(int) to authenticated;

-- ========== 4. agent_profile RLS ==========
alter table public.agent_profile enable row level security;

drop policy if exists "Allow read agent_profile" on public.agent_profile;
drop policy if exists "Allow insert agent_profile" on public.agent_profile;
drop policy if exists "Allow update agent_profile" on public.agent_profile;

create policy "Allow read agent_profile" on public.agent_profile for select using (true);
create policy "Allow insert agent_profile" on public.agent_profile for insert with check (true);
create policy "Allow update agent_profile" on public.agent_profile for update using (true);

-- ========== Realtime (opcional) ==========
-- En Dashboard: Database → Publications → supabase_realtime → añadir tabla agent_missions
