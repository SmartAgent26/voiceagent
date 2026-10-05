-- SEC-13: critical coaching writes must either all commit or all roll back.

alter table public.ai_usage_events
  add column if not exists request_id uuid;

create unique index if not exists ai_usage_events_request_id_key
  on public.ai_usage_events(request_id)
  where request_id is not null;

create or replace function public.persist_coach_exchange(
  p_athlete_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_athlete_content text,
  p_assistant_content text,
  p_model text,
  p_provider text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer,
  p_release_focus boolean default false
)
returns table (session_found boolean, already_persisted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.coaching_sessions%rowtype;
  assistant_message_id uuid;
begin
  select * into session_row
  from public.coaching_sessions
  where id = p_session_id
    and athlete_id = p_athlete_id
    and status = 'active'
  for update;

  if not found then
    return query select false, false;
    return;
  end if;

  if exists (select 1 from public.ai_usage_events where request_id = p_request_id) then
    return query select true, true;
    return;
  end if;

  if p_release_focus then
    update public.athlete_conversation_focus
    set is_active = false,
        closed_at = now()
    where athlete_id = p_athlete_id
      and is_active = true;
  end if;

  insert into public.session_messages (session_id, sender, content)
  values (p_session_id, 'athlete', p_athlete_content);

  insert into public.session_messages (session_id, sender, content, model)
  values (p_session_id, 'assistant', p_assistant_content, p_model)
  returning id into assistant_message_id;

  insert into public.ai_usage_events (
    athlete_id, session_id, message_id, provider, model, status,
    input_tokens, output_tokens, total_tokens, request_id
  ) values (
    p_athlete_id, p_session_id, assistant_message_id, p_provider, p_model, 'completed',
    p_input_tokens, p_output_tokens, p_total_tokens, p_request_id
  );

  return query select true, false;
end;
$$;

create or replace function public.close_coaching_session(
  p_athlete_id uuid,
  p_session_id uuid,
  p_summary text,
  p_focus text,
  p_duration_seconds integer,
  p_source_count integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.coaching_sessions%rowtype;
  has_athlete_message boolean;
  has_assistant_message boolean;
begin
  select * into session_row
  from public.coaching_sessions
  where id = p_session_id
    and athlete_id = p_athlete_id
  for update;

  if not found then
    return 'unavailable';
  end if;

  if session_row.status = 'closed' then
    return 'closed';
  end if;

  select
    bool_or(sender = 'athlete'),
    bool_or(sender = 'assistant')
  into has_athlete_message, has_assistant_message
  from public.session_messages
  where session_id = p_session_id;

  if not coalesce(has_athlete_message, false) or not coalesce(has_assistant_message, false) then
    delete from public.coaching_sessions where id = p_session_id;
    return 'discarded';
  end if;

  update public.coaching_sessions
  set status = 'closed',
      ended_at = now(),
      duration_seconds = greatest(0, p_duration_seconds),
      context_summary = nullif(trim(p_summary), '')
  where id = p_session_id;

  if nullif(trim(p_summary), '') is not null then
    insert into public.athlete_context_summaries (athlete_id, kind, content, source_count)
    values (p_athlete_id, 'session', trim(p_summary), greatest(0, p_source_count));
  end if;

  if nullif(trim(p_focus), '') is not null then
    insert into public.athlete_conversation_focus (
      athlete_id, topic, source_session_id, is_active, set_at, closed_at
    ) values (
      p_athlete_id, left(trim(p_focus), 500), p_session_id, true, now(), null
    )
    on conflict (athlete_id) do update
    set topic = excluded.topic,
        source_session_id = excluded.source_session_id,
        is_active = true,
        set_at = excluded.set_at,
        closed_at = null;
  end if;

  return 'closed';
end;
$$;

create or replace function public.grant_simulated_blocks(
  p_athlete_id uuid,
  p_blocks integer,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_row public.user_subscriptions%rowtype;
  subscription_exists boolean;
begin
  if p_blocks < 1 or p_blocks > 20 then
    raise exception 'Invalid simulated block quantity';
  end if;

  -- Serializes creation and grants for the same athlete.
  perform 1 from public.profiles where id = p_athlete_id for update;

  select * into subscription_row
  from public.user_subscriptions
  where user_id = p_athlete_id
  for update;
  subscription_exists := found;

  if exists (select 1 from public.credit_ledger where idempotency_key = format('simulated:%s', p_request_id)) then
    return coalesce(subscription_row.blocks_available, 0);
  end if;

  if not subscription_exists then
    insert into public.user_subscriptions (user_id, blocks_available, blocks_used, status)
    values (p_athlete_id, 0, 0, 'active')
    returning * into subscription_row;
  end if;

  update public.user_subscriptions
  set blocks_available = blocks_available + p_blocks,
      status = 'active',
      updated_at = now()
  where id = subscription_row.id
  returning * into subscription_row;

  insert into public.credit_ledger (
    user_id, subscription_id, event_type, blocks_delta, idempotency_key, metadata
  ) values (
    p_athlete_id, subscription_row.id, 'simulated_grant', p_blocks,
    format('simulated:%s', p_request_id), jsonb_build_object('simulated', true)
  );

  insert into public.simulated_block_purchases (user_id, blocks)
  values (p_athlete_id, p_blocks);

  insert into public.billing_events (
    user_id, subscription_id, event_type, amount_ars, status, metadata
  ) values (
    p_athlete_id, subscription_row.id, 'simulated_block_purchase', 0, 'completed',
    jsonb_build_object('blocks', p_blocks, 'simulated', true, 'request_id', p_request_id)
  );

  return subscription_row.blocks_available;
end;
$$;

revoke all on function public.persist_coach_exchange(uuid, uuid, uuid, text, text, text, text, integer, integer, integer, boolean) from public, authenticated;
revoke all on function public.close_coaching_session(uuid, uuid, text, text, integer, integer) from public, authenticated;
revoke all on function public.grant_simulated_blocks(uuid, integer, uuid) from public, authenticated;
grant execute on function public.persist_coach_exchange(uuid, uuid, uuid, text, text, text, text, integer, integer, integer, boolean) to service_role;
grant execute on function public.close_coaching_session(uuid, uuid, text, text, integer, integer) to service_role;
grant execute on function public.grant_simulated_blocks(uuid, integer, uuid) to service_role;
