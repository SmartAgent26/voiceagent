alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
comment on column public.profiles.display_name is 'Athlete preferred name, used by the coach and in the app.';
