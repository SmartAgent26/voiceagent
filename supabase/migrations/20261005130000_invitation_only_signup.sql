-- Los códigos se almacenan como hash HMAC: el valor original solo se muestra una vez al administrador.
create table public.invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  reserved_at timestamptz,
  reservation_id uuid,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((used_at is null and used_by is null) or (used_at is not null and used_by is not null))
);

create index invitation_codes_available_idx on public.invitation_codes (expires_at)
  where used_at is null;

alter table public.invitation_codes enable row level security;

-- Los únicos consumidores son endpoints de servidor con service_role.
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
    and expires_at > now();
  return found;
end;
$$;

create or replace function public.release_invitation_code(
  p_invitation_id uuid,
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invitation_codes
  set reserved_at = null, reservation_id = null
  where id = p_invitation_id
    and reservation_id = p_reservation_id
    and used_at is null;
  return found;
end;
$$;

revoke all on table public.invitation_codes from anon, authenticated;
revoke all on function public.reserve_invitation_code(text, uuid) from public, anon, authenticated;
revoke all on function public.consume_invitation_code(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_invitation_code(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_invitation_code(text, uuid) to service_role;
grant execute on function public.consume_invitation_code(uuid, uuid, uuid) to service_role;
grant execute on function public.release_invitation_code(uuid, uuid) to service_role;
