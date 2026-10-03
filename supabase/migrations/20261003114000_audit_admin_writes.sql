-- Audit writes are restricted to the administrative surface.
create policy audit_log_admin_insert on public.audit_log for insert to authenticated
with check (public.is_superadmin() and actor_id = auth.uid());
