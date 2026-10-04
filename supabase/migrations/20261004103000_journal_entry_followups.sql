-- Follow-ups are private notes that remain connected to an original journal record.
create table public.journal_entry_followups (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entry_followups_entry_created_idx on public.journal_entry_followups (journal_entry_id, created_at);
alter table public.journal_entry_followups enable row level security;
create policy journal_entry_followups_select_self on public.journal_entry_followups for select to authenticated using (athlete_id = auth.uid() or public.is_superadmin() or public.is_assigned_coach(athlete_id));
create policy journal_entry_followups_insert_self on public.journal_entry_followups for insert to authenticated with check (athlete_id = auth.uid());
create policy journal_entry_followups_update_self on public.journal_entry_followups for update to authenticated using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy journal_entry_followups_delete_self on public.journal_entry_followups for delete to authenticated using (athlete_id = auth.uid());
create trigger journal_entry_followups_set_updated_at before update on public.journal_entry_followups for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.journal_entry_followups to authenticated;
