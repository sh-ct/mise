-- Private buckets for recipe images (browser-resized WebP variants) and original scans.
-- Object paths start with the owner's id: {owner_id}/{recipe_id}/{uuid}-400.webp (ARCHITECTURE.md#data-model).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recipe-images', 'recipe-images', false, 5 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png']),
  ('recipe-scans', 'recipe-scans', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy recipe_files_owner_select on storage.objects for select to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-scans')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_files_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('recipe-images', 'recipe-scans')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_files_owner_update on storage.objects for update to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-scans')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('recipe-images', 'recipe-scans')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy recipe_files_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('recipe-images', 'recipe-scans')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
