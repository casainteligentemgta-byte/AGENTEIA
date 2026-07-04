-- D7: RLS por usuario en agent_missions (ejecutar en Supabase SQL Editor)
-- Idempotente: se puede ejecutar varias veces sin error.

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

-- Las misiones antiguas sin user_id no se muestran; opcional: asignarlas manualmente:
-- update public.agent_missions set user_id = 'TU-UUID-USUARIO' where user_id is null;
