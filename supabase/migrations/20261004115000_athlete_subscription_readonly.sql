-- Athletes can inspect their own plan in the readonly profile view.
create policy subscriptions_select_self on public.user_subscriptions for select to authenticated using (user_id = auth.uid());
create policy plans_select_authenticated on public.subscription_plans for select to authenticated using (true);
