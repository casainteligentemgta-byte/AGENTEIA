-- AGENTE IA — D7: RLS por usuario en agent_missions
-- Supabase → SQL Editor → New query → Run
-- Idempotente: se puede ejecutar varias veces.

drop policy if exists "Allow read agent_missions" on public.agent_missions;
drop policy if exists "Allow insert agent_missions" on public.agent_missions;
drop policy if exists "Allow update agent_missions" on public.agent_missions;
drop policy if exists "missions_select_own" on public.agent_missions;
drop policy if exists "missions_insert_own" on public.agent_missions;
drop policy if exists "missions_update_own" on public.agent_missions;

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

-- Opcional: asignar misiones legacy sin user_id a tu usuario
-- update public.agent_missions set user_id = 'TU-UUID-USUARIO' where user_id is null;

-- Verificación
select policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'agent_missions'
order by policyname;

-- Debe mostrar solo: missions_select_own, missions_insert_own, missions_update_own (authenticated)
