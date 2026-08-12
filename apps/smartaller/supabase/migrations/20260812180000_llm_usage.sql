-- Registro de uso de tokens LLM (OCR, chat, carga masiva) por taller.
-- Inserción vía service_role (Server Actions / API). Lectura RLS por taller.

create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  taller_id uuid references public.talleres (id) on delete set null,
  user_id uuid,
  action text not null default 'unknown',
  provider text not null default 'openai',
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  meta jsonb not null default '{}'::jsonb
);

comment on table public.llm_usage is
  'Consumo de tokens LLM por taller/acción para control de gastos (estimación USD).';

create index if not exists idx_llm_usage_taller_created
  on public.llm_usage (taller_id, created_at desc);

create index if not exists idx_llm_usage_taller_month
  on public.llm_usage (taller_id, created_at);

create index if not exists idx_llm_usage_action
  on public.llm_usage (taller_id, action);

alter table public.llm_usage enable row level security;

drop policy if exists "llm_usage select own taller" on public.llm_usage;
create policy "llm_usage select own taller"
  on public.llm_usage for select to authenticated
  using (taller_id = public.get_my_taller_id());

drop policy if exists "llm_usage all service role" on public.llm_usage;
create policy "llm_usage all service role"
  on public.llm_usage for all to service_role
  using (true)
  with check (true);
