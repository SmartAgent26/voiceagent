-- SEC-15: avatar originals must be sanitized server-side before storage.
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/webp'] where id = 'avatars';
drop policy if exists avatar_storage_insert on storage.objects;
drop policy if exists avatar_storage_update on storage.objects;
