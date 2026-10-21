-- Run in a transaction; no test rows or changes to real journals are retained.
begin;
select set_config('test.visit_owner', (select id::text from auth.users order by created_at limit 1), true);
select set_config('request.jwt.claim.sub', current_setting('test.visit_owner'), true);
select set_config('test.visit_one', gen_random_uuid()::text, true);
select set_config('test.visit_two', gen_random_uuid()::text, true);
set local role authenticated;
insert into public.ascent_visits(id, user_id, summit_id, completed_at, notes)
values (current_setting('test.visit_one')::uuid, auth.uid(), 'canigo', '2024-01-01', 'Policy test one'),
       (current_setting('test.visit_two')::uuid, auth.uid(), 'canigo', '2024-01-01', 'Policy test two');
do $$
begin
  if (select count(*) from public.ascent_visits where id in (current_setting('test.visit_one')::uuid, current_setting('test.visit_two')::uuid)) <> 2 then raise exception 'Repeated visits not preserved'; end if;
  update public.ascent_visits set notes = 'Updated one visit' where id = current_setting('test.visit_one')::uuid;
  if (select notes from public.ascent_visits where id = current_setting('test.visit_two')::uuid) <> 'Policy test two' then raise exception 'Update affected another visit'; end if;
  begin
    insert into public.ascent_visits(user_id, summit_id, completed_at) values ('00000000-0000-4000-8000-000000000099', 'canigo', '2024-01-01');
    raise exception 'Spoofed owner accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ascent_visits(user_id, summit_id, completed_at) values (auth.uid(), 'canigo', current_date + 1);
    raise exception 'Future date accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ascent_visits(user_id, summit_id, completed_at, notes) values (auth.uid(), 'canigo', '2024-01-01', repeat('x', 4001));
    raise exception 'Oversized notes accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ascent_visits(user_id, summit_id, completed_at, photo_path) values (auth.uid(), 'canigo', '2024-01-01', 'someone-else/canigo/photo.webp');
    raise exception 'Foreign photo accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
do $$
declare affected integer;
begin
  if exists(select 1 from public.ascent_visits where id = current_setting('test.visit_one')::uuid) then raise exception 'Another user can read visits'; end if;
  update public.ascent_visits set notes = 'Forbidden' where id = current_setting('test.visit_one')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user can edit visits'; end if;
  delete from public.ascent_visits where id = current_setting('test.visit_one')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user can delete visits'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.visit_owner'), true);
delete from public.ascent_visits where id = current_setting('test.visit_one')::uuid;
do $$ begin
  if not exists(select 1 from public.ascent_visits where id = current_setting('test.visit_two')::uuid) then raise exception 'Deleting one visit removed another'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform id from public.ascent_visits limit 1; raise exception 'Anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Repeated visits, isolated edits/deletes, owner-only access, dates, notes, photos and anonymous access: passed; all test changes rolled back.' as verification;
