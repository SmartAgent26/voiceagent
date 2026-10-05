-- SEC-14: identify the independent encryption key used for each credential.
alter table public.agent_provider_credentials
  add column if not exists key_version text not null default 'v1';
