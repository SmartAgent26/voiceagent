alter table public.journal_entries add column if not exists title text;
alter table public.journal_entries add column if not exists mood text;
alter table public.journal_entries add column if not exists goal_id text;
