-- SEC-04: an athlete may edit their profile, but never their operational access.
-- The existing trigger already protects role changes; extend it to account status.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role or old.account_status is distinct from new.account_status)
    and not public.is_superadmin() then
    raise exception 'Only a superadmin can change a user role or account status';
  end if;
  return new;
end;
$$;
