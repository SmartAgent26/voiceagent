-- Aksis MVP: identities, coaching history, journal and AI-usage telemetry.
-- Sensitive content remains private by default. All browser access is mediated by RLS.

create type public.app_role as enum ('athlete', 'coach', 'superadmin');
create type public.session_status as enum ('draft', 'active', 'closed', 'cancelled');
create type public.message_sender as enum ('athlete', 'assistant', 'human_coach', 'system');
create type public.usage_status as enum ('completed', 'error', 'timeout', 'safety_blocked');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'athlete',
  display_name text,
  avatar_url text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.athlete_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sport text,
  discipline text,
  competition_level text,
  goals text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  unique (coach_id, athlete_id),
  check (coach_id <> athlete_id)
);

create table public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status public.session_status not null default 'draft',
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  context_summary text,
  agent_model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions (id) on delete cascade,
  sender public.message_sender not null,
  content text not null check (char_length(content) between 1 and 4000),
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.coaching_sessions (id) on delete set null,
  message_id uuid references public.session_messages (id) on delete set null,
  provider text not null,
  model text not null,
  status public.usage_status not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  input_cost_usd numeric(14, 8) not null default 0 check (input_cost_usd >= 0),
  output_cost_usd numeric(14, 8) not null default 0 check (output_cost_usd >= 0),
  estimated_cost_usd numeric(14, 8) not null default 0 check (estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  occurred_at timestamptz not null default now(),
  coach_assistance_requested boolean not null default false,
  agent_reflection text,
  weekly_summary_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journal_media (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  applies_from timestamptz,
  applies_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (applies_until is null or applies_from is null or applies_until >= applies_from)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index coaching_sessions_athlete_started_idx on public.coaching_sessions (athlete_id, started_at desc);
create index session_messages_session_created_idx on public.session_messages (session_id, created_at);
create index ai_usage_events_athlete_created_idx on public.ai_usage_events (athlete_id, created_at desc);
create index journal_entries_athlete_occurred_idx on public.journal_entries (athlete_id, occurred_at desc);
create index coach_notes_athlete_created_idx on public.coach_notes (athlete_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger athlete_profiles_set_updated_at before update on public.athlete_profiles
for each row execute function public.set_updated_at();
create trigger coaching_sessions_set_updated_at before update on public.coaching_sessions
for each row execute function public.set_updated_at();
create trigger journal_entries_set_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();
create trigger coach_notes_set_updated_at before update on public.coach_notes
for each row execute function public.set_updated_at();

create function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create function public.is_assigned_coach(target_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_assignments
    where coach_id = auth.uid() and athlete_id = target_athlete_id
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'));

  insert into public.athlete_profiles (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.coach_assignments enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.session_messages enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_media enable row level security;
alter table public.coach_notes enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(id));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy athlete_profiles_select on public.athlete_profiles for select to authenticated
using (user_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(user_id));
create policy athlete_profiles_insert_self on public.athlete_profiles for insert to authenticated
with check (user_id = auth.uid());
create policy athlete_profiles_update_self on public.athlete_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy coach_assignments_select on public.coach_assignments for select to authenticated
using (coach_id = auth.uid() or athlete_id = auth.uid() or public.is_superadmin());
create policy coach_assignments_admin_all on public.coach_assignments for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());

create policy sessions_select on public.coaching_sessions for select to authenticated
using (athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(athlete_id));
create policy sessions_insert_self on public.coaching_sessions for insert to authenticated
with check (athlete_id = auth.uid());
create policy sessions_update_self on public.coaching_sessions for update to authenticated
using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy sessions_admin_all on public.coaching_sessions for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());

create policy session_messages_select on public.session_messages for select to authenticated
using (exists (
  select 1 from public.coaching_sessions session
  where session.id = session_id
    and (session.athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(session.athlete_id))
));
create policy session_messages_insert_athlete on public.session_messages for insert to authenticated
with check (sender = 'athlete' and exists (
  select 1 from public.coaching_sessions session
  where session.id = session_id and session.athlete_id = auth.uid()
));

create policy ai_usage_events_admin_select on public.ai_usage_events for select to authenticated
using (public.is_superadmin());

create policy journal_entries_select on public.journal_entries for select to authenticated
using (athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(athlete_id));
create policy journal_entries_insert_self on public.journal_entries for insert to authenticated
with check (athlete_id = auth.uid());
create policy journal_entries_update_self on public.journal_entries for update to authenticated
using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy journal_entries_delete_self on public.journal_entries for delete to authenticated
using (athlete_id = auth.uid());

create policy journal_media_select on public.journal_media for select to authenticated
using (athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(athlete_id));
create policy journal_media_insert_self on public.journal_media for insert to authenticated
with check (athlete_id = auth.uid());
create policy journal_media_delete_self on public.journal_media for delete to authenticated
using (athlete_id = auth.uid());

create policy coach_notes_select on public.coach_notes for select to authenticated
using (coach_id = auth.uid() or public.is_superadmin());
create policy coach_notes_insert on public.coach_notes for insert to authenticated
with check (coach_id = auth.uid() and public.is_assigned_coach(athlete_id));
create policy coach_notes_update_own on public.coach_notes for update to authenticated
using (coach_id = auth.uid()) with check (coach_id = auth.uid() and public.is_assigned_coach(athlete_id));
create policy coach_notes_delete_own on public.coach_notes for delete to authenticated
using (coach_id = auth.uid());

create policy audit_log_admin_select on public.audit_log for select to authenticated
using (public.is_superadmin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-media', 'journal-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy journal_media_storage_select on storage.objects for select to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy journal_media_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy journal_media_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.athlete_profiles, public.coach_assignments,
  public.coaching_sessions, public.session_messages, public.ai_usage_events, public.journal_entries,
  public.journal_media, public.coach_notes, public.audit_log to authenticated;
