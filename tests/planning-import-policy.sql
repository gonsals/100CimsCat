-- Synthetic accounts and all test records are rolled back; no emails are sent.
begin;
select set_config('test.owner', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
select set_config('test.list', gen_random_uuid()::text, true);
insert into auth.users(id, aud, role) values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated'),
  (current_setting('test.other')::uuid, 'authenticated', 'authenticated');
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
set local role authenticated;
select public.save_trip_list(current_setting('test.list')::uuid, 'Summer', '2027-06-01', 'Private plan', array['canigo','balandrau']);
select public.save_trip_list(current_setting('test.list')::uuid, 'Updated', '2027-07-01', 'Private plan', array['balandrau','canigo']);
do $$ begin
  begin
    perform public.save_trip_list(null, 'Wrong account', null, '', '{}', current_setting('test.other')::uuid);
    raise exception 'Stale account save accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.import_journal('[{"summit_id":"canigo","completed_at":"2024-01-01"}]', current_setting('test.other')::uuid);
    raise exception 'Stale account import accepted';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.trip_lists where user_id = auth.uid()) <> 1 then raise exception 'List retry duplicated'; end if;
  if (select summit_id from public.trip_list_summits where list_id = current_setting('test.list')::uuid and position = 0) <> 'balandrau' then raise exception 'Order not saved'; end if;
  begin
    perform public.save_trip_list(current_setting('test.list')::uuid, 'Must roll back', null, '', array['not-a-summit']);
    raise exception 'Unknown summit accepted';
  exception when foreign_key_violation then null; end;
  if (select name from public.trip_lists where id = current_setting('test.list')::uuid) <> 'Updated' then raise exception 'Failed list save was partial'; end if;
  begin
    perform public.save_trip_list(current_setting('test.list')::uuid, 'Invalid', null, '', array['canigo','canigo']);
    raise exception 'Duplicate selection accepted';
  exception when invalid_parameter_value then null; end;
end $$;

insert into public.ascent_records(user_id, summit_id, completed_at, notes, photo_path)
  values (auth.uid(), 'canigo', '2024-01-01', 'Keep existing notes', auth.uid()::text || '/canigo/keep.webp');
do $$
declare result jsonb;
begin
  result := public.import_journal('[
    {"summit_id":"canigo","completed_at":"2024-01-01","notes":"Must not overwrite","favorite":true},
    {"summit_id":"canigo","completed_at":"2024-02-01","notes":"New visit","favorite":true},
    {"summit_id":"canigo","completed_at":"2024-02-01","notes":"Duplicate","favorite":false},
    {"summit_id":"balandrau","completed_at":null,"notes":"","favorite":true}
  ]');
  if jsonb_array_length(result->'visits') <> 1 or jsonb_array_length(result->'favorites') <> 2 or (result->>'skipped')::int <> 2 then raise exception 'Wrong import result: %', result; end if;
  if (select notes from public.ascent_records where user_id=auth.uid() and summit_id='canigo') <> 'Keep existing notes' then raise exception 'Existing notes overwritten'; end if;
  if (select photo_path from public.ascent_records where user_id=auth.uid() and summit_id='canigo') is null then raise exception 'Existing photo removed'; end if;
  result := public.import_journal('[{"summit_id":"canigo","completed_at":"2024-02-01","notes":"Retry","favorite":true}]');
  if jsonb_array_length(result->'visits') <> 0 or jsonb_array_length(result->'favorites') <> 0 then raise exception 'Retry duplicated data'; end if;
  begin
    perform public.import_journal('[{"summit_id":"balandrau","completed_at":"2024-03-01","notes":"Roll back"},{"summit_id":"not-a-summit","completed_at":"2024-04-01"}]');
    raise exception 'Invalid import accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.ascent_visits where user_id=auth.uid() and summit_id='balandrau') then raise exception 'Failed import was partial'; end if;
  begin
    perform public.import_journal('[{"summit_id":"canigo","completed_at":"2099-01-01"}]');
    raise exception 'Future import accepted';
  exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.other'), true);
do $$ declare affected integer;
begin
  if exists(select 1 from public.trip_lists) or exists(select 1 from public.trip_list_summits) then raise exception 'Another user can see plans'; end if;
  begin
    perform public.save_trip_list(current_setting('test.list')::uuid, 'Foreign edit', null, '', '{}');
    raise exception 'Foreign list edit accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.trip_list_summits(list_id,user_id,summit_id,position) values(current_setting('test.list')::uuid,auth.uid(),'bastiments',2);
    raise exception 'Foreign list membership accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.trip_lists(user_id,name) values(current_setting('test.owner')::uuid,'Spoofed');
    raise exception 'Spoofed owner accepted';
  exception when insufficient_privilege then null; end;
  delete from public.trip_lists where id=current_setting('test.list')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user can delete plans'; end if;
  if exists(select 1 from public.ascent_visits where user_id=current_setting('test.owner')::uuid) then raise exception 'Foreign visits visible'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.trip_lists; raise exception 'Anonymous plans visible'; exception when insufficient_privilege then null; end;
  begin perform public.import_journal('[]'); raise exception 'Anonymous import allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_trip_list(null,'Anon',null,'','{}'); raise exception 'Anonymous save allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
set local role authenticated;
delete from public.trip_lists where id=current_setting('test.list')::uuid;
do $$ begin if exists(select 1 from public.trip_list_summits where user_id=auth.uid()) then raise exception 'List deletion did not cascade'; end if; end $$;
rollback;
select 'Planning isolation, atomic saves, idempotent imports, preserved notes/photos and anonymous restrictions: passed; rolled back.' as verification;
