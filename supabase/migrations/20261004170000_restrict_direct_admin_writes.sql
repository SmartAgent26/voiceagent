-- SEC-09: administrative mutations are performed through the protected server API.
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_update_superadmin on public.profiles;
drop policy if exists plans_admin on public.subscription_plans;
drop policy if exists subscriptions_admin on public.user_subscriptions;
drop policy if exists billing_admin on public.billing_events;
drop policy if exists agent_configurations_admin_all on public.agent_configurations;
drop policy if exists agent_prompt_versions_admin_all on public.agent_prompt_versions;
drop policy if exists agent_reference_questions_superadmin_all on public.agent_reference_questions;
drop policy if exists audit_log_admin_insert on public.audit_log;

create policy subscription_plans_admin_select on public.subscription_plans for select to authenticated
using (public.is_superadmin());
create policy user_subscriptions_admin_select on public.user_subscriptions for select to authenticated
using (public.is_superadmin());
create policy billing_events_admin_select on public.billing_events for select to authenticated
using (public.is_superadmin());
create policy agent_configurations_admin_select on public.agent_configurations for select to authenticated
using (public.is_superadmin());
create policy agent_prompt_versions_admin_select on public.agent_prompt_versions for select to authenticated
using (public.is_superadmin());
create policy agent_reference_questions_admin_select on public.agent_reference_questions for select to authenticated
using (public.is_superadmin());

create or replace function public.prevent_audit_log_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Audit log entries are immutable';
end;
$$;

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function public.prevent_audit_log_mutation();
