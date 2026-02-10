-- Tabla de perfil del agente (skills/tags desbloqueadas).
-- Ejecutar en el SQL Editor de Supabase o con: supabase db push

create table if not exists public.agent_profile (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Tags/skills desbloqueadas (ej: 'contexto', 'resúmenes', 'código').
  tags text[] not null default '{}'
);

-- Un solo perfil por defecto (el componente lee el primero).
insert into public.agent_profile (tags)
select array['contexto', 'memoria', 'asistente']
where not exists (select 1 from public.agent_profile limit 1);

-- Si prefieres un único registro "singleton", descomenta y ajusta:
-- alter table public.agent_profile add constraint agent_profile_singleton check (id = '00000000-0000-0000-0000-000000000001');

comment on table public.agent_profile is 'Perfil del agente: tags/skills desbloqueadas para AgentStatus';
