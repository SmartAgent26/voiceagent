-- Non-secret agent settings. Provider credentials stay exclusively in server environment variables.
create table public.agent_configurations (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  provider text not null check (provider in ('gemini', 'openai', 'openrouter')),
  model text not null,
  system_prompt text not null check (char_length(system_prompt) between 100 and 20000),
  input_price_per_million_usd numeric(14,6) not null default 0 check (input_price_per_million_usd >= 0),
  output_price_per_million_usd numeric(14,6) not null default 0 check (output_price_per_million_usd >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index agent_configurations_one_active_idx
  on public.agent_configurations (is_active) where is_active;

create trigger agent_configurations_set_updated_at before update on public.agent_configurations
for each row execute function public.set_updated_at();

alter table public.agent_configurations enable row level security;
create policy agent_configurations_admin_all on public.agent_configurations for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());
grant select, insert, update, delete on public.agent_configurations to authenticated;

create table public.agent_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null references public.agent_configurations(id) on delete cascade,
  prompt text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.agent_prompt_versions enable row level security;
create policy agent_prompt_versions_admin_all on public.agent_prompt_versions for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());
grant select, insert, update, delete on public.agent_prompt_versions to authenticated;
