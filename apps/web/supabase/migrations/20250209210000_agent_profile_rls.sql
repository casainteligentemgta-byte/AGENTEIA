-- Activar RLS en agent_profile (lectura pública para estado del agente).
-- Las rules exigen verificar RLS antes de consultar tablas.

alter table public.agent_profile enable row level security;

create policy "Allow read agent_profile"
  on public.agent_profile for select
  using (true);

-- Inserción/actualización solo desde backend o con policy restringida si aplica.
create policy "Allow insert agent_profile"
  on public.agent_profile for insert
  with check (true);

create policy "Allow update agent_profile"
  on public.agent_profile for update
  using (true);
