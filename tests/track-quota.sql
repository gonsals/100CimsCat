-- Exercise the deployed trigger against temporary quota rows only.
begin;
create temporary table track_quota_rows(user_id uuid,visit_key text,data jsonb);
create temporary table track_quota_writes(user_id uuid,visit_key text,data jsonb);
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.validate_visit_track()'::regprocedure);
 definition:=replace(definition,'private.validate_visit_track','pg_temp.validate_track_probe');
 definition:=replace(definition,'public.visit_tracks','pg_temp.track_quota_rows');
 execute definition;
end $$;
create trigger track_probe before insert or update on track_quota_writes for each row execute function pg_temp.validate_track_probe();
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-fffffffffff1',true);
insert into track_quota_writes values(auth.uid(),'valid','{"segments":[[{"lat":42,"lng":2},{"lat":43,"lng":2}]]}');
do $$ begin
 begin
  insert into track_quota_writes values(auth.uid(),'oversized',jsonb_build_object('segments','[[{"lat":42,"lng":2},{"lat":43,"lng":2}]]'::jsonb,'padding',repeat('x',1048576)));
  raise exception 'Oversized track accepted';
 exception when invalid_parameter_value then null; end;
 begin
  insert into track_quota_writes select auth.uid(),'points',jsonb_build_object('segments',jsonb_build_array(jsonb_agg(jsonb_build_object('lat',42,'lng',2)))) from generate_series(1,10001);
  raise exception 'Too many points accepted';
 exception when invalid_parameter_value then null; end;
end $$;
insert into track_quota_rows values(auth.uid(),'filler',jsonb_build_object('padding',repeat('x',10485760)));
do $$ begin
 begin insert into track_quota_writes values(auth.uid(),'quota','{"segments":[[{"lat":42,"lng":2},{"lat":43,"lng":2}]]}'); raise exception 'Account quota exceeded';
 exception when check_violation then null; end;
end $$;
truncate track_quota_rows;
insert into track_quota_rows values('ffffffff-ffff-4fff-8fff-fffffffffff2','filler',jsonb_build_object('padding',repeat('x',52428800)));
do $$ begin
 begin insert into track_quota_writes values(auth.uid(),'global','{"segments":[[{"lat":42,"lng":2},{"lat":43,"lng":2}]]}'); raise exception 'Global quota exceeded';
 exception when check_violation then null; end;
end $$;
select 'track-quota passed' as result;
rollback;
