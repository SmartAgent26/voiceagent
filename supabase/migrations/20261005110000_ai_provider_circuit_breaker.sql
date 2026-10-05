-- SEC-08: shared circuit breaker avoids retry storms against a failing AI provider.
create table public.ai_provider_circuits (
  provider text primary key check (provider in ('gemini', 'openai', 'openrouter')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  opened_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ai_provider_circuits enable row level security;
revoke all on public.ai_provider_circuits from anon, authenticated;

create or replace function public.is_ai_provider_available(p_provider text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_opened_until timestamptz;
begin
  select opened_until into v_opened_until from public.ai_provider_circuits where provider = p_provider;
  return v_opened_until is null or v_opened_until <= now();
end;
$$;

create or replace function public.record_ai_provider_outcome(p_provider text, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_failures integer;
begin
  if p_provider not in ('gemini', 'openai', 'openrouter') then raise exception 'Unsupported provider'; end if;
  if p_success then
    insert into public.ai_provider_circuits (provider, consecutive_failures, opened_until) values (p_provider, 0, null)
    on conflict (provider) do update set consecutive_failures = 0, opened_until = null, updated_at = now();
    return;
  end if;
  insert into public.ai_provider_circuits (provider, consecutive_failures) values (p_provider, 1)
  on conflict (provider) do update set consecutive_failures = public.ai_provider_circuits.consecutive_failures + 1, updated_at = now()
  returning consecutive_failures into v_failures;
  if v_failures >= 3 then
    update public.ai_provider_circuits set opened_until = now() + interval '2 minutes', updated_at = now() where provider = p_provider;
  end if;
end;
$$;
revoke all on function public.is_ai_provider_available(text), public.record_ai_provider_outcome(text, boolean) from public, anon, authenticated;
grant execute on function public.is_ai_provider_available(text), public.record_ai_provider_outcome(text, boolean) to service_role;
