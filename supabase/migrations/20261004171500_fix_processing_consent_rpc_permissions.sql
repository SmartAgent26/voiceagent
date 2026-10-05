-- The RPC writes only the authenticated caller's row, while direct client writes remain blocked.
create or replace function public.set_processing_consents(
  p_ai_coaching boolean,
  p_weekly_journal_summary boolean,
  p_voice_transcription boolean default false,
  p_photo_ai_processing boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.processing_consents (user_id, ai_coaching, weekly_journal_summary, voice_transcription, photo_ai_processing, updated_at)
  values (auth.uid(), p_ai_coaching, p_weekly_journal_summary, p_voice_transcription, p_photo_ai_processing, now())
  on conflict (user_id) do update set
    ai_coaching = excluded.ai_coaching,
    weekly_journal_summary = excluded.weekly_journal_summary,
    voice_transcription = excluded.voice_transcription,
    photo_ai_processing = excluded.photo_ai_processing,
    updated_at = now();
end;
$$;

revoke all on function public.set_processing_consents(boolean, boolean, boolean, boolean) from public;
grant execute on function public.set_processing_consents(boolean, boolean, boolean, boolean) to authenticated;
