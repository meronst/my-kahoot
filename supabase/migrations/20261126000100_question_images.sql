-- supabase/migrations/20261126000100_question_images.sql — storage for question images (KQ-17).
--
-- Concept — Supabase Storage: files live in "buckets" (like top-level folders). Each file is a row
-- in storage.objects, so the same Row Level Security we use for tables decides who may upload.
--
-- Bucket "question-images" is PUBLIC for reading: phones of anonymous players and the projector load
-- images by URL with no login. That's fine: an image is shown with its question and never reveals
-- the answer key. File names are random, so they can't be guessed before the question appears.
--
-- Writing is for hosts only, and only inside a folder named after a quiz they own:
--   <quiz_id>/<random>.jpg
-- The browser resizes before uploading (≤ 1600px JPEG); the 1 MB limit here is the safety net.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the first folder of an object's path is a quiz owned by the caller.
-- storage.foldername('a/b.jpg') returns {a}. SECURITY INVOKER: quizzes RLS applies too.
create or replace function public.owns_quiz_folder(p_object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.is_host() and exists (
    select 1 from public.quizzes q
    where q.owner_id = (select auth.uid())
      and q.id::text = (storage.foldername(p_object_name))[1]
  );
$$;
revoke execute on function public.owns_quiz_folder(text) from public;
grant execute on function public.owns_quiz_folder(text) to authenticated, service_role;

create policy question_images_host_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images' and public.owns_quiz_folder(name));

create policy question_images_host_update on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and public.owns_quiz_folder(name))
  with check (bucket_id = 'question-images' and public.owns_quiz_folder(name));

create policy question_images_host_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.owns_quiz_folder(name));

-- Deleting needs to SELECT the row first (Storage API does), so hosts can see their own objects.
create policy question_images_host_select on storage.objects
  for select to authenticated
  using (bucket_id = 'question-images' and public.owns_quiz_folder(name));
