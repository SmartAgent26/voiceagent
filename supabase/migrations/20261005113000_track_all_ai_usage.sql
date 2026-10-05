-- Registra el consumo de todas las operaciones de IA sin almacenar contenido.
alter table public.ai_usage_events
  add column if not exists operation text not null default 'coach_reply'
  check (operation in ('coach_reply', 'goal_assistance', 'session_summary', 'weekly_journal_summary'));

create index if not exists ai_usage_events_operation_created_idx
  on public.ai_usage_events (operation, created_at desc);
