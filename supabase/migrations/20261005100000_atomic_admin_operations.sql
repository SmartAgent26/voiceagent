-- SEC-13 / SEC-09: each administrative mutation and its audit event commit together.
create or replace function public.perform_admin_operation(
  p_admin_id uuid,
  p_action text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_plan_blocks integer;
  v_active boolean;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'superadmin' and account_status = 'active') then
    raise exception 'Only an active superadmin can perform this operation';
  end if;

  if p_action = 'plan.create' then
    insert into public.subscription_plans (name, monthly_blocks, price_ars)
    values (p_payload->'data'->>'name', (p_payload->'data'->>'monthlyBlocks')::integer, (p_payload->'data'->>'priceArs')::numeric)
    returning id into v_entity_id;
  elsif p_action = 'plan.update' then
    v_entity_id := (p_payload->>'id')::uuid;
    update public.subscription_plans set name = p_payload->'data'->>'name', monthly_blocks = (p_payload->'data'->>'monthlyBlocks')::integer, price_ars = (p_payload->'data'->>'priceArs')::numeric, active = (p_payload->'data'->>'active')::boolean where id = v_entity_id;
    if not found then raise exception 'Plan not found'; end if;
  elsif p_action = 'plan.cancel' then
    v_entity_id := (p_payload->>'id')::uuid;
    update public.subscription_plans set active = false where id = v_entity_id;
    if not found then raise exception 'Plan not found'; end if;
  elsif p_action = 'plan.delete' then
    v_entity_id := (p_payload->>'id')::uuid;
    if exists (select 1 from public.user_subscriptions where plan_id = v_entity_id) then raise exception 'This plan has linked athletes'; end if;
    delete from public.subscription_plans where id = v_entity_id;
    if not found then raise exception 'Plan not found'; end if;
  elsif p_action = 'athlete.status' then
    v_entity_id := (p_payload->>'id')::uuid;
    update public.profiles set account_status = (p_payload->>'accountStatus')::public.account_status where id = v_entity_id and role = 'athlete';
    if not found then raise exception 'Athlete not found'; end if;
  elsif p_action = 'subscription.assign' then
    v_entity_id := (p_payload->>'athleteId')::uuid;
    select monthly_blocks into v_plan_blocks from public.subscription_plans where id = (p_payload->>'planId')::uuid and active = true;
    if v_plan_blocks is null then raise exception 'Active plan not found'; end if;
    insert into public.user_subscriptions (user_id, plan_id, blocks_available, blocks_used, status)
    values (v_entity_id, (p_payload->>'planId')::uuid, v_plan_blocks, 0, 'active')
    on conflict (user_id) do update set plan_id = excluded.plan_id, blocks_available = excluded.blocks_available, blocks_used = 0, status = 'active', updated_at = now();
  elsif p_action = 'question.create' then
    insert into public.agent_reference_questions (category, question, purpose, position)
    values (p_payload->'data'->>'category', p_payload->'data'->>'question', p_payload->'data'->>'purpose', 9999)
    returning id into v_entity_id;
  elsif p_action = 'question.update' then
    v_entity_id := (p_payload->>'id')::uuid;
    update public.agent_reference_questions set category = p_payload->'data'->>'category', question = p_payload->'data'->>'question', purpose = p_payload->'data'->>'purpose' where id = v_entity_id;
    if not found then raise exception 'Question not found'; end if;
  elsif p_action = 'question.active' then
    v_entity_id := (p_payload->>'id')::uuid;
    update public.agent_reference_questions set is_active = (p_payload->>'isActive')::boolean where id = v_entity_id;
    if not found then raise exception 'Question not found'; end if;
  elsif p_action = 'question.delete' then
    v_entity_id := (p_payload->>'id')::uuid;
    delete from public.agent_reference_questions where id = v_entity_id;
    if not found then raise exception 'Question not found'; end if;
  elsif p_action = 'agent.configure' then
    v_active := (p_payload->>'id') is null;
    if v_active then update public.agent_configurations set is_active = false where is_active = true; end if;
    if v_active then
      insert into public.agent_configurations (provider, model, system_prompt, input_price_per_million_usd, output_price_per_million_usd, is_active, updated_by)
      values (p_payload->'data'->>'provider', p_payload->'data'->>'model', p_payload->'data'->>'systemPrompt', (p_payload->'data'->>'inputPrice')::numeric, (p_payload->'data'->>'outputPrice')::numeric, true, p_admin_id)
      returning id into v_entity_id;
    else
      v_entity_id := (p_payload->>'id')::uuid;
      update public.agent_configurations set provider = p_payload->'data'->>'provider', model = p_payload->'data'->>'model', system_prompt = p_payload->'data'->>'systemPrompt', input_price_per_million_usd = (p_payload->'data'->>'inputPrice')::numeric, output_price_per_million_usd = (p_payload->'data'->>'outputPrice')::numeric, is_active = true, updated_by = p_admin_id where id = v_entity_id;
      if not found then raise exception 'Agent configuration not found'; end if;
    end if;
    insert into public.agent_prompt_versions (configuration_id, prompt, created_by) values (v_entity_id, p_payload->'data'->>'systemPrompt', p_admin_id);
  else
    raise exception 'Unsupported admin operation';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (p_admin_id, p_action,
    case when p_action like 'plan.%' then 'subscription_plan' when p_action = 'athlete.status' then 'athlete' when p_action = 'subscription.assign' then 'user_subscription' when p_action like 'question.%' then 'agent_reference_question' else 'agent_configuration' end,
    v_entity_id,
    jsonb_build_object('transactional', true));
  return v_entity_id;
end;
$$;

revoke all on function public.perform_admin_operation(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.perform_admin_operation(uuid, text, jsonb) to service_role;
