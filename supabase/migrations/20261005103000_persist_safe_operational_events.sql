-- SEC-18: central operational telemetry with an allow-listed schema only.
create table public.operational_events (
  id bigint generated always as identity primary key,
  event text not null check (char_length(event) between 1 and 120),
  request_id uuid,
  route text not null check (char_length(route) between 1 and 180),
  outcome text not null check (outcome in ('error', 'warning', 'info')),
  status integer check (status between 100 and 599),
  error_type text check (error_type is null or char_length(error_type) <= 120),
  created_at timestamptz not null default now()
);
create index operational_events_created_idx on public.operational_events (created_at desc);
alter table public.operational_events enable row level security;
create policy operational_events_superadmin_select on public.operational_events for select to authenticated using (public.is_superadmin());
revoke all on public.operational_events from anon, authenticated;
grant select on public.operational_events to authenticated;
