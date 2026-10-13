-- Storage probes INSERT permission before uploading the file. During that probe
-- metadata.size is absent; newer Storage versions may provide contentLength.
-- Reserve the bucket's maximum file size when neither is available, so missing
-- metadata cannot bypass the account/global quotas. The bucket still enforces
-- the actual 512 KiB limit and permitted image types.
alter policy "Users can upload their summit photos"
on storage.objects
with check (
  bucket_id = 'summit-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and public.can_upload_summit_photo(
    coalesce(
      (metadata ->> 'size')::bigint,
      (metadata ->> 'contentLength')::bigint,
      524288
    ),
    coalesce(user_metadata ->> 'replace_path', metadata ->> 'replace_path')
  )
);
