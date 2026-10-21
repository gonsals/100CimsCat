-- Exercise the deployed quota function against temporary fixtures only.
begin;
create temporary table quota_objects (name text, bucket_id text, metadata jsonb);
create temporary table quota_first (user_id uuid, photo_path text);
create temporary table quota_visits (user_id uuid, photo_path text);
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.can_upload_summit_photo(bigint,text)'::regprocedure);
  definition := replace(definition, 'public.can_upload_summit_photo', 'pg_temp.can_upload_visit_probe');
  definition := replace(definition, 'storage.objects', 'pg_temp.quota_objects');
  definition := replace(definition, 'public.ascent_records', 'pg_temp.quota_first');
  definition := replace(definition, 'public.ascent_visits', 'pg_temp.quota_visits');
  execute definition;
end $$;
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-fffffffffff1', true);
insert into quota_objects values
  ('ffffffff-ffff-4fff-8fff-fffffffffff1/canigo/visit.webp', 'summit-photos', '{"size":524288}'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff1/filler.webp', 'summit-photos', '{"size":293076992}');
insert into quota_visits values ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'ffffffff-ffff-4fff-8fff-fffffffffff1/canigo/visit.webp');
do $$ begin
  if pg_temp.can_upload_visit_probe(524288, null) then raise exception 'Full account accepted extra upload'; end if;
  if not pg_temp.can_upload_visit_probe(524288, 'ffffffff-ffff-4fff-8fff-fffffffffff1/canigo/visit.webp') then raise exception 'Visit photo replacement not recognized'; end if;
  if pg_temp.can_upload_visit_probe(524288, 'ffffffff-ffff-4fff-8fff-fffffffffff1/filler.webp') then raise exception 'Unlinked photo bypassed quota'; end if;
end $$;
delete from quota_visits;
insert into quota_first values ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'ffffffff-ffff-4fff-8fff-fffffffffff1/canigo/visit.webp');
do $$ begin
  if not pg_temp.can_upload_visit_probe(524288, 'ffffffff-ffff-4fff-8fff-fffffffffff1/canigo/visit.webp') then raise exception 'Original photo replacement regressed'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  if pg_temp.can_upload_visit_probe(1024, null) then raise exception 'Anonymous upload allowed'; end if;
end $$;
rollback;
select 'Photo quota: new visit and original replacements accepted at cap; extra, unlinked and anonymous uploads rejected. Temporary fixtures rolled back.' as verification;
