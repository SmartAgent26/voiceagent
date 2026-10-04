-- Never expose or reuse provider reasoning that may have been stored before
-- Gemini thought parts were filtered in the application layer.
update public.coaching_sessions
set context_summary = null
where context_summary ~* '^\s*(the user wants|analysis of the session|drafting summary|constraints:|internal process|system prompt)';

delete from public.athlete_context_summaries
where kind = 'session'
  and content ~* '^\s*(the user wants|analysis of the session|drafting summary|constraints:|internal process|system prompt)';
