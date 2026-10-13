-- Run against Supabase using execute_sql or psql. All fixtures live in a
-- temporary copy: no storage object, account or ascent record is modified.
begin;

create temporary table photo_policy_probe (like storage.objects including defaults);
alter table photo_policy_probe enable row level security;
grant select, insert on photo_policy_probe to authenticated;

do $$
declare
  predicate text;
begin
  select with_check into strict predicate
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can upload their summit photos' and cmd = 'INSERT';
  execute format(
    'create policy upload_probe on photo_policy_probe for insert to authenticated with check (%s)',
    predicate
  );
end;
$$;

create policy read_probe on photo_policy_probe for select to authenticated
using (bucket_id = 'summit-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-fffffffffff1', true);
set local role authenticated;

do $$
declare
  own_folder text := auth.uid()::text || '/';
  invalid_case record;
begin
  if not public.can_upload_summit_photo(524288, null) then
    raise exception 'Test requires at least 512 KiB of available photo quota';
  end if;

  -- Both current and older Storage permission probes, plus final metadata.
  insert into photo_policy_probe (bucket_id, name, metadata) values
    ('summit-photos', own_folder || 'content-length.webp', '{"mimetype":"image/webp","contentLength":1024}'),
    ('summit-photos', own_folder || 'missing-size.webp', '{"mimetype":"image/webp"}'),
    ('summit-photos', own_folder || 'null-metadata.webp', null),
    ('summit-photos', own_folder || 'actual-size.webp', '{"size":1024}'),
    ('summit-photos', own_folder || 'limit.webp', '{"size":524288}');

  for invalid_case in
    select * from (values
      ('another-account', 'summit-photos', 'ffffffff-ffff-4fff-8fff-fffffffffff2/photo.webp', '{"size":1024}'::jsonb),
      ('another-bucket', 'other-bucket', own_folder || 'photo.webp', '{"size":1024}'::jsonb),
      ('too-large', 'summit-photos', own_folder || 'too-large.webp', '{"size":524289}'::jsonb),
      ('probe-too-large', 'summit-photos', own_folder || 'probe-too-large.webp', '{"contentLength":524289}'::jsonb),
      ('empty-file', 'summit-photos', own_folder || 'empty.webp', '{"size":0}'::jsonb),
      ('actual-size-wins', 'summit-photos', own_folder || 'actual-size-wins.webp', '{"size":524289,"contentLength":1024}'::jsonb)
    ) as cases(label, bucket, path, metadata)
  loop
    begin
      insert into photo_policy_probe (bucket_id, name, metadata)
      values (invalid_case.bucket, invalid_case.path, invalid_case.metadata);
      raise exception 'Policy incorrectly allowed %', invalid_case.label;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    insert into photo_policy_probe (bucket_id, name, metadata)
    values ('summit-photos', own_folder || 'no-user.webp', '{"size":1024}');
    raise exception 'Policy incorrectly allowed a request without a user';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
select 'Photo upload policy: 5 valid cases accepted, 7 invalid cases rejected' as result;
rollback;
