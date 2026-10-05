-- SEC-02: Superadministration operates on aggregate metadata only.
-- It must not read athlete coaching content, journal data, summaries, or coach notes.

drop policy if exists athlete_profiles_select on public.athlete_profiles;
create policy athlete_profiles_select on public.athlete_profiles for select to authenticated
using (user_id = auth.uid() or public.is_assigned_coach(user_id));

drop policy if exists sessions_select on public.coaching_sessions;
create policy sessions_select on public.coaching_sessions for select to authenticated
using (athlete_id = auth.uid() or public.is_assigned_coach(athlete_id));

drop policy if exists session_messages_select on public.session_messages;
create policy session_messages_select on public.session_messages for select to authenticated
using (exists (
  select 1 from public.coaching_sessions session
  where session.id = session_id
    and (session.athlete_id = auth.uid() or public.is_assigned_coach(session.athlete_id))
));

drop policy if exists journal_entries_select on public.journal_entries;
create policy journal_entries_select on public.journal_entries for select to authenticated
using (athlete_id = auth.uid());

drop policy if exists journal_media_select on public.journal_media;
create policy journal_media_select on public.journal_media for select to authenticated
using (athlete_id = auth.uid());

drop policy if exists journal_entry_followups_select_self on public.journal_entry_followups;
create policy journal_entry_followups_select_self on public.journal_entry_followups for select to authenticated
using (athlete_id = auth.uid());

drop policy if exists athlete_context_summaries_select on public.athlete_context_summaries;
create policy athlete_context_summaries_select on public.athlete_context_summaries for select to authenticated
using (athlete_id = auth.uid());

drop policy if exists coach_notes_select on public.coach_notes;
create policy coach_notes_select on public.coach_notes for select to authenticated
using (coach_id = auth.uid());

-- Returns only operational aggregates. No athlete IDs, session text, journal text,
-- summaries, prompts, or note contents are exposed to the admin browser.
create or replace function public.get_admin_operational_metrics()
returns table (
  active_athletes bigint,
  sessions_this_month bigint,
  total_tokens bigint,
  estimated_cost_usd numeric,
  ai_errors bigint,
  active_plans bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can read operational metrics';
  end if;

  return query
  select
    (select count(*) from public.profiles where role = 'athlete' and account_status = 'active'),
    (select count(*) from public.coaching_sessions where started_at >= date_trunc('month', now())),
    (select coalesce(sum(total_tokens), 0) from public.ai_usage_events),
    (select coalesce(sum(estimated_cost_usd), 0) from public.ai_usage_events),
    (select count(*) from public.ai_usage_events where status in ('error', 'timeout')),
    (select count(*) from public.subscription_plans where active = true);
end;
$$;

revoke all on function public.get_admin_operational_metrics() from public;
grant execute on function public.get_admin_operational_metrics() to authenticated;
