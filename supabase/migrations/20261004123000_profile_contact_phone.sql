alter table public.profiles add column if not exists phone text;
comment on column public.profiles.phone is 'Optional contact number supplied by the athlete.';
