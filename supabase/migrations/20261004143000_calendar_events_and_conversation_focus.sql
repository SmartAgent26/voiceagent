create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  starts_at timestamptz not null,
  all_day boolean not null default false,
  custom_label text,
  tags text[] not null default '{}'::text[],
  expected_state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_athlete_starts_idx on public.calendar_events(athlete_id, starts_at);
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
alter table public.calendar_events enable row level security;
create policy calendar_events_owner_all on public.calendar_events for all to authenticated
using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
grant select, insert, update, delete on public.calendar_events to authenticated;

create table public.athlete_conversation_focus (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  topic text not null check (char_length(trim(topic)) between 3 and 500),
  source_session_id uuid references public.coaching_sessions(id) on delete set null,
  is_active boolean not null default true,
  set_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.athlete_conversation_focus enable row level security;
create policy athlete_conversation_focus_owner_select on public.athlete_conversation_focus for select to authenticated using (athlete_id = auth.uid());
grant select on public.athlete_conversation_focus to authenticated;
