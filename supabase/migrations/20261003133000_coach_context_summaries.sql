-- Compact longitudinal context. Raw journal and conversation content stays in its own private tables.
create type public.context_summary_kind as enum ('session', 'weekly_journal');

create table public.athlete_context_summaries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  kind public.context_summary_kind not null,
  period_start date,
  period_end date,
  content text not null check (char_length(content) between 1 and 2400),
  source_count integer not null default 0 check (source_count >= 0),
  generated_at timestamptz not null default now(),
  unique (athlete_id, kind, period_start)
);

create index athlete_context_summaries_lookup_idx
  on public.athlete_context_summaries (athlete_id, kind, generated_at desc);

alter table public.athlete_context_summaries enable row level security;
create policy athlete_context_summaries_select on public.athlete_context_summaries for select to authenticated
using (athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(athlete_id));
grant select on public.athlete_context_summaries to authenticated;
