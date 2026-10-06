-- Keep personal photo storage within a predictable free-tier budget.
update storage.buckets
set file_size_limit = 524288
where id = 'summit-photos';

create or replace function public.get_my_photo_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
  from storage.objects as o
  where o.bucket_id = 'summit-photos'
    and (storage.foldername(o.name))[1] = (select auth.uid()::text);
$$;

create or replace function public.can_upload_summit_photo(
  p_file_size bigint,
  p_replace_path text default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  replace_size bigint := 0;
  used_bytes bigint := 0;
  total_bytes bigint := 0;
begin
  if current_user_id is null or p_file_size is null or p_file_size < 1 or p_file_size > 524288 then
    return false;
  end if;

  -- Serialize competing inserts so simultaneous uploads cannot pass the cap together.
  perform pg_advisory_xact_lock(hashtext('100cimscat-summit-photos-free-quota'));

  if p_replace_path is not null then
    select coalesce((o.metadata ->> 'size')::bigint, 0)
      into replace_size
      from storage.objects as o
      join public.ascent_records as a
        on a.user_id = current_user_id and a.photo_path = o.name
     where o.bucket_id = 'summit-photos'
       and o.name = p_replace_path
       and (storage.foldername(o.name))[1] = current_user_id::text
     limit 1;
  end if;

  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
    into used_bytes
    from storage.objects as o
   where o.bucket_id = 'summit-photos'
     and (storage.foldername(o.name))[1] = current_user_id::text
     and (replace_size = 0 or o.name is distinct from p_replace_path);

  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
    into total_bytes
    from storage.objects as o
   where o.bucket_id = 'summit-photos'
     and (replace_size = 0 or o.name is distinct from p_replace_path);

  return used_bytes + p_file_size <= 293601280 -- 280 MiB per account
    and total_bytes + p_file_size <= 943718400; -- 900 MiB global ceiling
end;
$$;

revoke all on function public.get_my_photo_storage_bytes() from public, anon;
revoke all on function public.can_upload_summit_photo(bigint, text) from public, anon;
grant execute on function public.get_my_photo_storage_bytes() to authenticated;
grant execute on function public.can_upload_summit_photo(bigint, text) to authenticated;

drop policy if exists "Users can upload their summit photos" on storage.objects;
create policy "Users can upload their summit photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'summit-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and public.can_upload_summit_photo(
    coalesce((metadata ->> 'size')::bigint, 0),
    coalesce(user_metadata ->> 'replace_path', metadata ->> 'replace_path')
  )
);
