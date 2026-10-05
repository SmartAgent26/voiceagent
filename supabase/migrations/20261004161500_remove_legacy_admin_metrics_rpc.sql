-- Telemetry now goes through the protected Next.js administrative API.
-- Remove the legacy PostgREST RPC that could fail and was not needed by clients.
drop function if exists public.get_admin_operational_metrics();
