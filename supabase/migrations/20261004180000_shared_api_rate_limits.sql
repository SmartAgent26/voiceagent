-- SEC-08: rate-limit counters shared by every application replica.
create table if not exists public.api_rate_limit_windows (
  scope text not null,
  identity text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (scope, identity, window_started_at)
);

alter table public.api_rate_limit_windows enable row level security;
revoke all on table public.api_rate_limit_windows from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_identity text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, limit_value integer, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_count integer;
begin
  if length(trim(p_scope)) = 0 or length(trim(p_identity)) = 0 or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  v_window_started_at := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limit_windows (scope, identity, window_started_at, request_count)
  values (left(p_scope, 80), left(p_identity, 180), v_window_started_at, 1)
  on conflict (scope, identity, window_started_at) do update
  set request_count = public.api_rate_limit_windows.request_count + 1
  where public.api_rate_limit_windows.request_count < p_limit
  returning request_count into v_count;

  if v_count is null then
    select request_count into v_count
    from public.api_rate_limit_windows
    where scope = left(p_scope, 80)
      and identity = left(p_identity, 180)
      and window_started_at = v_window_started_at;
  end if;

  return query select
    v_count <= p_limit,
    p_limit,
    greatest(0, p_limit - v_count),
    greatest(1, ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
