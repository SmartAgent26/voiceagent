-- SEC-05: legal acceptance is derived from the current documents in the database,
-- never from versions or hashes supplied by the browser.
alter table public.legal_documents
  add column if not exists is_current boolean not null default true;

create unique index if not exists legal_documents_one_current_version_idx
  on public.legal_documents (document_key)
  where is_current = true;

drop policy if exists terms_acceptances_insert_own on public.terms_acceptances;
revoke insert on public.terms_acceptances from authenticated;

create or replace function public.accept_current_legal_documents()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.terms_acceptances (
    user_id,
    document_key,
    document_version,
    document_hash,
    read_at
  )
  select
    auth.uid(),
    document_key,
    version,
    content_hash,
    now()
  from public.legal_documents
  where is_current = true
  on conflict (user_id, document_key, document_version)
  do update set
    document_hash = excluded.document_hash,
    read_at = excluded.read_at,
    accepted_at = now();

  if (select count(*) from public.legal_documents where is_current = true) <> 3 then
    raise exception 'The required legal document set is incomplete';
  end if;
end;
$$;

create or replace function public.has_accepted_current_legal_documents()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (select count(*) from public.legal_documents where is_current = true) = 3
    and not exists (
      select 1
      from public.legal_documents document
      where document.is_current = true
        and not exists (
          select 1
          from public.terms_acceptances acceptance
          where acceptance.user_id = auth.uid()
            and acceptance.document_key = document.document_key
            and acceptance.document_version = document.version
            and acceptance.document_hash = document.content_hash
        )
    );
$$;

revoke all on function public.accept_current_legal_documents() from public;
revoke all on function public.has_accepted_current_legal_documents() from public;
grant execute on function public.accept_current_legal_documents() to authenticated;
grant execute on function public.has_accepted_current_legal_documents() to authenticated;

-- Legal text is versioned by insertion. Published versions are immutable so a
-- user acceptance can always be tied back to the exact approved document.
create or replace function public.prevent_legal_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_current = true
    and new.is_current = false
    and old.document_key = new.document_key
    and old.version = new.version
    and old.title = new.title
    and old.content = new.content
    and old.content_hash = new.content_hash
    and old.published_at = new.published_at then
    return new;
  end if;
  raise exception 'Published legal documents are immutable; publish a new version instead';
end;
$$;

drop trigger if exists legal_documents_immutable on public.legal_documents;
create trigger legal_documents_immutable
before update or delete on public.legal_documents
for each row execute function public.prevent_legal_document_mutation();

create or replace function public.publish_legal_document(
  p_document_key public.legal_document_key,
  p_version text,
  p_title text,
  p_content text,
  p_content_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  published_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can publish legal documents';
  end if;

  update public.legal_documents
  set is_current = false
  where document_key = p_document_key and is_current = true;

  insert into public.legal_documents (document_key, version, title, content, content_hash, is_current)
  values (p_document_key, p_version, p_title, p_content, p_content_hash, true)
  returning id into published_id;

  return published_id;
end;
$$;

revoke all on function public.publish_legal_document(public.legal_document_key, text, text, text, text) from public;
grant execute on function public.publish_legal_document(public.legal_document_key, text, text, text, text) to authenticated;
