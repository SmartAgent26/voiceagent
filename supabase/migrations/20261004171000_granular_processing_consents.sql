-- SEC-10: separate, revocable consent for each sensitive processing purpose.
create table public.processing_consents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ai_coaching boolean not null default false,
  weekly_journal_summary boolean not null default false,
  voice_transcription boolean not null default false,
  photo_ai_processing boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.processing_consents enable row level security;
create policy processing_consents_select_self on public.processing_consents for select to authenticated using (user_id = auth.uid());

create or replace function public.set_processing_consents(
  p_ai_coaching boolean,
  p_weekly_journal_summary boolean,
  p_voice_transcription boolean default false,
  p_photo_ai_processing boolean default false
)
returns void language plpgsql security invoker set search_path = public as $$
begin
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
grant execute on function public.set_processing_consents(boolean, boolean, boolean, boolean) to authenticated;
