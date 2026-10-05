-- SEC-07: session block charging is atomic and append-only.
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  session_id uuid references public.coaching_sessions(id) on delete set null,
  event_type text not null check (event_type in ('session_block_charge', 'simulated_grant', 'payment_grant', 'reversal', 'expiry')),
  blocks_delta integer not null check (blocks_delta <> 0),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);
create index credit_ledger_session_idx on public.credit_ledger(session_id) where session_id is not null;
alter table public.credit_ledger enable row level security;

create or replace function public.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Credit ledger entries are immutable';
end;
$$;

create trigger credit_ledger_immutable
before update or delete on public.credit_ledger
for each row execute function public.prevent_credit_ledger_mutation();

alter table public.user_subscriptions
  add constraint user_subscriptions_blocks_available_nonnegative check (blocks_available >= 0),
  add constraint user_subscriptions_blocks_used_nonnegative check (blocks_used >= 0);

create or replace function public.charge_session_blocks(
  p_athlete_id uuid,
  p_session_id uuid
)
returns table (
  session_found boolean,
  allowed boolean,
  blocks_remaining integer,
  additional_blocks integer,
  required_blocks integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.coaching_sessions%rowtype;
  subscription_row public.user_subscriptions%rowtype;
  required integer;
  additional integer;
begin
  select * into session_row
  from public.coaching_sessions
  where id = p_session_id
    and athlete_id = p_athlete_id
    and status = 'active'
  for update;

  if not found then
    return query select false, false, 0, 0, 0;
    return;
  end if;

  required := floor(greatest(0, extract(epoch from now() - session_row.started_at)) / 900)::integer + 1;
  additional := greatest(0, required - session_row.blocks_charged);

  select * into subscription_row
  from public.user_subscriptions
  where user_id = p_athlete_id
  for update;

  if not found or subscription_row.blocks_available < additional then
    return query select true, false, coalesce(subscription_row.blocks_available, 0), additional, required;
    return;
  end if;

  if additional > 0 then
    insert into public.credit_ledger (
      user_id,
      subscription_id,
      session_id,
      event_type,
      blocks_delta,
      idempotency_key,
      metadata
    ) values (
      p_athlete_id,
      subscription_row.id,
      p_session_id,
      'session_block_charge',
      -additional,
      format('session:%s:block:%s', p_session_id, required),
      jsonb_build_object('required_blocks', required, 'charged_blocks', additional)
    );

    update public.user_subscriptions
    set blocks_available = blocks_available - additional,
        blocks_used = blocks_used + additional,
        updated_at = now()
    where id = subscription_row.id;

    update public.coaching_sessions
    set blocks_charged = required
    where id = p_session_id;
  end if;

  return query select true, true, subscription_row.blocks_available - additional, additional, required;
end;
$$;

revoke all on function public.charge_session_blocks(uuid, uuid) from public;
revoke all on function public.charge_session_blocks(uuid, uuid) from authenticated;
grant execute on function public.charge_session_blocks(uuid, uuid) to service_role;
