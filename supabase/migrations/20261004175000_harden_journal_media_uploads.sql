-- SEC-15: only the server-side sanitization route may create journal media.
-- Uploaded originals are never stored; the route decodes and re-encodes WebP.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/webp']
where id = 'journal-media';

drop policy if exists journal_media_storage_insert on storage.objects;
drop policy if exists journal_media_storage_delete on storage.objects;
drop policy if exists journal_media_insert_self on public.journal_media;
drop policy if exists journal_media_delete_self on public.journal_media;
