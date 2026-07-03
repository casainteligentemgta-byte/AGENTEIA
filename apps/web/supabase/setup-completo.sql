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

-- ========== 3. agent_memory + pgvector ==========
create extension if not exists vector with schema extensions;

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  embedding extensions.vector(1536) not null
);

alter table public.agent_memory enable row level security;

drop policy if exists "Allow read agent_memory" on public.agent_memory;
drop policy if exists "Allow insert agent_memory" on public.agent_memory;

create policy "Allow read agent_memory" on public.agent_memory for select using (true);
create policy "Allow insert agent_memory" on public.agent_memory for insert with check (true);

create or replace function public.match_agent_memories(
  query_embedding extensions.vector(1536),
  match_count int default 10
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select agent_memory.id, agent_memory.content,
    1 - (agent_memory.embedding <=> query_embedding) as similarity
  from public.agent_memory
  order by agent_memory.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

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
