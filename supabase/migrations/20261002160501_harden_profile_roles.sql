-- Prevent privilege escalation through profile updates.

create function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_superadmin() then
    raise exception 'Only a superadmin can change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_unauthorized_role_change
before update on public.profiles
for each row execute function public.prevent_unauthorized_role_change();

drop policy profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_superadmin on public.profiles for update to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());
