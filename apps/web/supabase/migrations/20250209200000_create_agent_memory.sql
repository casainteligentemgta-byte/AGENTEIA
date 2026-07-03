-- Memoria del agente: contenido + embedding para búsqueda semántica.
-- Requiere extensión pgvector. Ejecutar en SQL Editor o: supabase db push

create extension if not exists vector with schema extensions;

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  embedding extensions.vector(1536) not null  -- OpenAI text-embedding-3-small
);

comment on table public.agent_memory is 'Memorias del agente con embeddings para búsqueda semántica';

-- RLS: solo el backend (service role o server con anon) escribe; lectura para contexto del chat.
alter table public.agent_memory enable row level security;

create policy "Allow read agent_memory"
  on public.agent_memory for select
  using (true);

create policy "Allow insert agent_memory"
  on public.agent_memory for insert
  with check (true);

-- RPC para búsqueda por similitud (cosine). match_count limita resultados.
create or replace function public.match_agent_memories(
  query_embedding extensions.vector(1536),
  match_count int default 10
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    agent_memory.id,
    agent_memory.content,
    1 - (agent_memory.embedding <=> query_embedding) as similarity
  from public.agent_memory
  order by agent_memory.embedding <=> query_embedding
  limit least(match_count, 50);
$$;
