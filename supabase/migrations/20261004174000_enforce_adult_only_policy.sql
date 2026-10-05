-- SEC-06: the MVP is adult-only. Enforce the policy even if the browser is bypassed.
create or replace function public.enforce_adult_only_athlete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.date_of_birth is not null and new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Aksis MVP is available only to adults';
  end if;
  return new;
end;
$$;

drop trigger if exists athlete_profiles_adult_only on public.athlete_profiles;
create trigger athlete_profiles_adult_only
before insert or update of date_of_birth on public.athlete_profiles
for each row execute function public.enforce_adult_only_athlete();
