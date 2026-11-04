-- Synthetic accounts, no emails and no persistent test records.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
select set_config('test.visit',gen_random_uuid()::text,true);
select set_config('test.backup',gen_random_uuid()::text,true);
select set_config('test.list',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role) values
 (current_setting('test.owner')::uuid,'authenticated','authenticated'),
 (current_setting('test.other')::uuid,'authenticated','authenticated');
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
select public.sync_pending_visit(current_setting('test.visit')::uuid,'canigo','2024-01-01','Pending note',auth.uid());
select public.sync_pending_visit(current_setting('test.visit')::uuid,'canigo','2024-01-01','Pending note',auth.uid());
insert into public.journal_goals values(auth.uid(),2026,'unique',20);
insert into public.visit_tracks(user_id,visit_key,summit_id,visit_id,filename,data)
 values(auth.uid(),current_setting('test.visit'),'canigo',current_setting('test.visit')::uuid,'route.gpx','{"segments":[[{"lat":42,"lng":2,"ele":100},{"lat":42.01,"lng":2.01,"ele":120}]]}');
select public.save_trip_list(current_setting('test.list')::uuid,'Shared title','2027-01-01','Secret notes',array['canigo'],auth.uid());
select set_config('test.token',(public.publish_trip(current_setting('test.list')::uuid,auth.uid())->>'token'),true);
do $$ declare result jsonb; begin
 if (select count(*) from public.ascent_visits)<>1 then raise exception 'Offline retry duplicated'; end if;
 begin perform public.sync_pending_visit(current_setting('test.visit')::uuid,'canigo','2024-01-01','Different',auth.uid()); raise exception 'Pending mismatch accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sync_pending_visit(gen_random_uuid(),'canigo','2024-01-01','',current_setting('test.other')::uuid); raise exception 'Stale owner accepted'; exception when insufficient_privilege then null; end;
 begin update public.visit_tracks set data='{"segments":[[{"lat":91,"lng":2},{"lat":42,"lng":2}]]}'; raise exception 'Invalid coordinates accepted'; exception when invalid_parameter_value then null; end;
 begin update public.visit_tracks set data='{"segments":[[{"lat":42,"lng":2}]]}'; raise exception 'One point accepted'; exception when invalid_parameter_value then null; end;
 result:=public.restore_backup_visits(current_setting('test.backup')::uuid,'[{"source_key":"one","summit_id":"balandrau","completed_at":"2024-02-01","notes":"Same day"},{"source_key":"two","summit_id":"balandrau","completed_at":"2024-02-01","notes":"Same day"}]',auth.uid());
 if jsonb_array_length(result)<>2 or (select count(*) from public.ascent_visits)<>3 then raise exception 'Identical visits lost'; end if;
 result:=public.restore_backup_visits(current_setting('test.backup')::uuid,'[{"source_key":"one","summit_id":"balandrau","completed_at":"2024-02-01","notes":"Same day"},{"source_key":"two","summit_id":"balandrau","completed_at":"2024-02-01","notes":"Same day"}]',auth.uid());
 if (result->0->>'created')::boolean or (result->1->>'created')::boolean or (select count(*) from public.ascent_visits)<>3 then raise exception 'Restore retry duplicated'; end if;
 perform public.restore_backup_extras(array['canigo'],'[]','[{"year":2026,"metric":"visits","target":100},{"year":2025,"metric":"visits","target":5}]',auth.uid());
 if (select target from public.journal_goals where year=2026)<>20 then raise exception 'Goal overwritten'; end if;
 begin perform public.restore_backup_visits(gen_random_uuid(),'[{"source_key":"bad","summit_id":"unknown","completed_at":"2024-02-01","notes":""}]',auth.uid()); raise exception 'Unknown summit accepted'; exception when foreign_key_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin
 if exists(select 1 from public.journal_goals) or exists(select 1 from public.visit_tracks) or exists(select 1 from public.backup_visit_receipts) or exists(select 1 from public.shared_trips) then raise exception 'Private rows leaked'; end if;
 begin perform public.publish_trip(current_setting('test.list')::uuid,auth.uid()); raise exception 'Other account published list'; exception when insufficient_privilege then null; end;
 begin insert into public.visit_tracks(user_id,visit_key,summit_id,visit_id,filename,data) values(auth.uid(),current_setting('test.visit'),'canigo',current_setting('test.visit')::uuid,'route.gpx','{"segments":[[{"lat":42,"lng":2},{"lat":43,"lng":2}]]}'); raise exception 'Track linked to other owner'; exception when foreign_key_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.headers','{}',true);
set local role anon;
do $$ begin
 if exists(select token from public.shared_trips) then raise exception 'Public enumeration allowed'; end if;
 begin perform source_list_id from public.shared_trips; raise exception 'Private source readable'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.headers',jsonb_build_object('x-share-token',current_setting('test.token'))::text,true);
do $$ begin
 if (select count(token) from public.shared_trips)<>1 or (select title from public.shared_trips)<>'Shared title' then raise exception 'Token read failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
delete from public.shared_trips where token=current_setting('test.token')::uuid;
delete from public.ascent_visits where id=current_setting('test.visit')::uuid;
do $$ begin if exists(select 1 from public.visit_tracks) then raise exception 'Deleted visit left track'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin if exists(select token from public.shared_trips) then raise exception 'Revoked link accessible'; end if; end $$;
reset role;
select 'mountain-features-policy passed' as result;
rollback;
