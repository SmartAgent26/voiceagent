-- API secrets are AES-256-GCM encrypted before reaching this table. No browser role can read them.
create table public.agent_provider_credentials (
  provider text primary key check (provider in ('gemini', 'openai', 'openrouter')),
  encrypted_secret text not null,
  iv text not null,
  auth_tag text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger agent_provider_credentials_set_updated_at before update on public.agent_provider_credentials
for each row execute function public.set_updated_at();
alter table public.agent_provider_credentials enable row level security;
