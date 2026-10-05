alter table public.invitation_codes
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null;

create or replace function public.reserve_invitation_code(
  p_code_hash text,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  update public.invitation_codes
  set reserved_at = now(), reservation_id = p_reservation_id
  where code_hash = p_code_hash
    and used_at is null
    and disabled_at is null
    and expires_at > now()
    and (reserved_at is null or reserved_at < now() - interval '15 minutes')
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.consume_invitation_code(
  p_invitation_id uuid,
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invitation_codes
  set used_at = now(), used_by = p_user_id, reservation_id = null
  where id = p_invitation_id
    and reservation_id = p_reservation_id
    and used_at is null
    and disabled_at is null
    and expires_at > now();
  return found;
end;
$$;
