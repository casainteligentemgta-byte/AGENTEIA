-- Mission Control: misiones del agente (Growth Coach).
-- Ejecutar en el SQL Editor de Supabase o con: supabase db push

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

comment on table public.agent_missions is 'Misiones asignadas por el agente (Growth Coach). user_id opcional si no hay auth.';

-- RLS: permitir lectura/inserción con anon o authenticated (ajusta según tu política).
alter table public.agent_missions enable row level security;

create policy "Allow read agent_missions"
  on public.agent_missions for select
  using (true);

create policy "Allow insert agent_missions"
  on public.agent_missions for insert
  with check (true);

create policy "Allow update agent_missions"
  on public.agent_missions for update
  using (true);
