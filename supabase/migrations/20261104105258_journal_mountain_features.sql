create table public.journal_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  metric text not null check (metric in ('essential','unique','visits')),
  target integer not null check (target between 1 and 1000),
  primary key (user_id, year)
);
alter table public.journal_goals enable row level security;
revoke all on public.journal_goals from public, anon, authenticated;
grant select, insert, update, delete on public.journal_goals to authenticated;
create policy "Owners manage annual goals" on public.journal_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Composite references bind both kinds of visits to their owner and summit.
alter table public.ascent_visits add constraint ascent_visits_identity_owner_summit unique (id,user_id,summit_id);
create table public.visit_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_key text not null,
  summit_id text not null references public.summits(id) on delete cascade,
  visit_id uuid,
  first_summit_id text,
  filename text not null check (char_length(filename) between 1 and 120),
  data jsonb not null check (octet_length(data::text) <= 1048576),
  primary key(user_id,visit_key),
  foreign key(visit_id,user_id,summit_id) references public.ascent_visits(id,user_id,summit_id) on delete cascade,
  foreign key(user_id,first_summit_id) references public.ascent_records(user_id,summit_id) on delete cascade,
  check ((visit_id is not null and first_summit_id is null and visit_key=visit_id::text)
    or (visit_id is null and first_summit_id is not null and first_summit_id=summit_id and visit_key='first:'||summit_id))
);
create index visit_tracks_visit_owner_idx on public.visit_tracks(visit_id,user_id,summit_id);
create index visit_tracks_first_idx on public.visit_tracks(user_id,first_summit_id);
create index visit_tracks_summit_idx on public.visit_tracks(summit_id);
alter table public.visit_tracks enable row level security;
revoke all on public.visit_tracks from public,anon,authenticated;
grant select,insert,update,delete on public.visit_tracks to authenticated;
create policy "Owners manage visit tracks" on public.visit_tracks for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
-- This non-exposed trigger needs a global byte total, rather than the rows
-- visible through RLS. Every write, including direct REST writes, is checked.
create function private.validate_visit_track() returns trigger language plpgsql security definer set search_path='' as $$
declare segment jsonb; point jsonb; points integer:=0; own_bytes bigint; total_bytes bigint;
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
  if octet_length(new.data::text)>1048576 or jsonb_typeof(new.data) is distinct from 'object' or jsonb_typeof(new.data->'segments') is distinct from 'array'
    or jsonb_array_length(new.data->'segments') not between 1 and 1000 then raise invalid_parameter_value using message='Invalid track'; end if;
  for segment in select value from jsonb_array_elements(new.data->'segments') loop
    if jsonb_typeof(segment) is distinct from 'array' or jsonb_array_length(segment)<2 then raise invalid_parameter_value using message='Invalid segment'; end if;
    for point in select value from jsonb_array_elements(segment) loop
      points:=points+1;
      if points>10000 then raise invalid_parameter_value; end if;
      if jsonb_typeof(point->'lat') is distinct from 'number' or jsonb_typeof(point->'lng') is distinct from 'number'
        or abs((point->>'lat')::numeric)>90 or abs((point->>'lng')::numeric)>180
        or (point ? 'ele' and (jsonb_typeof(point->'ele') is distinct from 'number' or (point->>'ele')::numeric not between -500 and 10000)) then
        raise invalid_parameter_value using message='Invalid point';
      end if;
    end loop;
  end loop;
  if points>10000 then raise invalid_parameter_value using message='Too many points'; end if;
  perform pg_advisory_xact_lock(hashtext('100cimscat-track-quota'));
  select coalesce(sum(octet_length(data::text)),0) into own_bytes from public.visit_tracks where user_id=new.user_id and visit_key<>new.visit_key;
  select coalesce(sum(octet_length(data::text)),0) into total_bytes from public.visit_tracks where not(user_id=new.user_id and visit_key=new.visit_key);
  if own_bytes+octet_length(new.data::text)>10485760 or total_bytes+octet_length(new.data::text)>52428800 then raise check_violation using message='Track quota exceeded'; end if;
  return new;
end; $$;
revoke all on function private.validate_visit_track() from public,anon,authenticated;
create trigger validate_visit_track before insert or update on public.visit_tracks for each row execute function private.validate_visit_track();

create function public.sync_pending_visit(p_id uuid,p_summit text,p_date date,p_notes text,p_expected_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.ascent_visits%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise insufficient_privilege; end if;
  insert into public.ascent_visits(id,user_id,summit_id,completed_at,notes)
    values(p_id,auth.uid(),p_summit,p_date,p_notes) on conflict(id) do nothing;
  select * into saved from public.ascent_visits where id=p_id and user_id=auth.uid();
  if saved.id is null or saved.summit_id<>p_summit or saved.completed_at<>p_date or saved.notes<>p_notes then
    raise invalid_parameter_value using message='Pending visit mismatch';
  end if;
  return to_jsonb(saved)-'user_id';
end; $$;
revoke all on function public.sync_pending_visit(uuid,text,date,text,uuid) from public,anon;
grant execute on function public.sync_pending_visit(uuid,text,date,text,uuid) to authenticated;

create table public.shared_trips (
  token uuid primary key default gen_random_uuid(),
  source_list_id uuid not null unique references public.trip_lists(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 80),
  planned_on date,
  summit_ids text[] not null check(cardinality(summit_ids)<=522),
  expires_at timestamptz not null default now()+interval '30 days'
);
alter table public.shared_trips enable row level security;
revoke all on public.shared_trips from public,anon,authenticated;
grant select,insert,update,delete on public.shared_trips to authenticated;
grant select(token,title,planned_on,summit_ids,expires_at) on public.shared_trips to anon;
create policy "Owners manage shared trips" on public.shared_trips for all to authenticated
  using (exists(select 1 from public.trip_lists l where l.id=source_list_id and l.user_id=(select auth.uid())))
  with check (exists(select 1 from public.trip_lists l where l.id=source_list_id and l.user_id=(select auth.uid())));
create policy "A share token grants public read" on public.shared_trips for select to anon
  using (expires_at>now() and token::text=(nullif(current_setting('request.headers',true),'')::jsonb->>'x-share-token'));
create function public.publish_trip(p_list uuid,p_expected_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare source public.trip_lists%rowtype; saved public.shared_trips%rowtype; ids text[];
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise insufficient_privilege; end if;
  select * into source from public.trip_lists where id=p_list and user_id=auth.uid();
  if source.id is null then raise insufficient_privilege; end if;
  select coalesce(array_agg(summit_id order by position),'{}') into ids from public.trip_list_summits where list_id=p_list and user_id=auth.uid();
  insert into public.shared_trips(source_list_id,title,planned_on,summit_ids)
    values(source.id,source.name,source.planned_on,ids)
    on conflict(source_list_id) do update set title=excluded.title,planned_on=excluded.planned_on,summit_ids=excluded.summit_ids,expires_at=now()+interval '30 days'
    returning * into saved;
  return jsonb_build_object('token',saved.token,'title',saved.title,'planned_on',saved.planned_on,'summit_ids',saved.summit_ids,'expires_at',saved.expires_at);
end; $$;
revoke all on function public.publish_trip(uuid,uuid) from public,anon;
grant execute on function public.publish_trip(uuid,uuid) to authenticated;

-- Restore receipts keep retries safe, including identical visits on one day.
create table public.backup_visit_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_id uuid not null,
  source_key text not null check(char_length(source_key) between 1 and 150),
  summit_id text not null,
  visit_id uuid,
  first_summit_id text,
  primary key(user_id,backup_id,source_key),
  foreign key(visit_id,user_id,summit_id) references public.ascent_visits(id,user_id,summit_id) on delete cascade,
  foreign key(user_id,first_summit_id) references public.ascent_records(user_id,summit_id) on delete cascade,
  check((visit_id is null) <> (first_summit_id is null))
);
create index backup_receipts_visit_idx on public.backup_visit_receipts(visit_id,user_id,summit_id);
create index backup_receipts_first_idx on public.backup_visit_receipts(user_id,first_summit_id);
alter table public.backup_visit_receipts enable row level security;
revoke all on public.backup_visit_receipts from public,anon,authenticated;
grant select,insert on public.backup_visit_receipts to authenticated;
create policy "Owners manage backup receipts" on public.backup_visit_receipts for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create function public.restore_backup_visits(p_backup uuid,p_rows jsonb,p_expected_user uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; receipt public.backup_visit_receipts%rowtype; target_id uuid; target_first text; v_summit text; v_date date; v_notes text; record_json jsonb; restored jsonb:='[]'; created boolean;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user then raise insufficient_privilege; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended('100cimscat-restore:'||auth.uid()::text,0));
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item->'source_key') is distinct from 'string' or jsonb_typeof(item->'notes') is distinct from 'string'
      or char_length(item->>'notes')>4000 or char_length(item->>'source_key') not between 1 and 150
      or (item->>'completed_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise invalid_parameter_value; end if;
    v_summit:=item->>'summit_id';v_date:=(item->>'completed_at')::date;v_notes:=item->>'notes';created:=false;
    target_id:=null;target_first:=null;
    select * into receipt from public.backup_visit_receipts where user_id=auth.uid() and backup_id=p_backup and source_key=item->>'source_key';
    if found then target_id:=receipt.visit_id;target_first:=receipt.first_summit_id;
    else
      if item->>'source_key'='first:'||v_summit then
        select summit_id into target_first from public.ascent_records where user_id=auth.uid() and summit_id=v_summit and completed_at=v_date;
      elsif (item->>'source_key') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select id into target_id from public.ascent_visits where user_id=auth.uid() and id=(item->>'source_key')::uuid and summit_id=v_summit and completed_at=v_date;
      end if;
      if target_id is null and target_first is null then
        select v.id into target_id from public.ascent_visits v where v.user_id=auth.uid() and v.summit_id=v_summit and v.completed_at=v_date and v.notes=v_notes
          and not exists(select 1 from public.backup_visit_receipts r where r.user_id=auth.uid() and r.backup_id=p_backup and r.visit_id=v.id) order by v.created_at,v.id limit 1;
      end if;
      if target_id is null and target_first is null then
        insert into public.ascent_visits(user_id,summit_id,completed_at,notes) values(auth.uid(),v_summit,v_date,v_notes) returning id into target_id;created:=true;
      end if;
      insert into public.backup_visit_receipts(user_id,backup_id,source_key,summit_id,visit_id,first_summit_id)
        values(auth.uid(),p_backup,item->>'source_key',v_summit,target_id,target_first);
    end if;
    if target_id is not null then select to_jsonb(v)-'user_id' into record_json from public.ascent_visits v where v.user_id=auth.uid() and v.id=target_id and v.summit_id=v_summit and v.completed_at=v_date;
    else select to_jsonb(v)-'user_id' into record_json from public.ascent_records v where v.user_id=auth.uid() and v.summit_id=target_first and v.summit_id=v_summit and v.completed_at=v_date; end if;
    if record_json is null then raise invalid_parameter_value using message='Backup receipt mismatch'; end if;
    restored:=restored||jsonb_build_array(jsonb_build_object('source_key',item->>'source_key','visit',record_json,'created',created));
  end loop;
  return restored;
end; $$;
revoke all on function public.restore_backup_visits(uuid,jsonb,uuid) from public,anon;
grant execute on function public.restore_backup_visits(uuid,jsonb,uuid) to authenticated;

create function public.restore_backup_extras(p_favorites text[],p_lists jsonb,p_goals jsonb,p_expected_user uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; saved_id uuid; owner_id uuid:=auth.uid();
begin
  if owner_id is null or owner_id is distinct from p_expected_user then raise insufficient_privilege; end if;
  if cardinality(p_favorites)>522 or jsonb_typeof(p_lists) is distinct from 'array' or jsonb_array_length(p_lists)>1000
    or jsonb_typeof(p_goals) is distinct from 'array' or jsonb_array_length(p_goals)>101 then raise invalid_parameter_value; end if;
  insert into public.summit_favorites(user_id,summit_id) select owner_id,id from unnest(p_favorites) id on conflict do nothing;
  for item in select value from jsonb_array_elements(p_lists) loop
    saved_id:=null;
    if jsonb_typeof(item->'summitIds') is distinct from 'array' or jsonb_array_length(item->'summitIds')>522 then raise invalid_parameter_value; end if;
    if exists(select 1 from public.trip_lists where user_id=owner_id and id=(item->>'source_id')::uuid) then continue; end if;
    insert into public.trip_lists(id,user_id,name,planned_on,notes)
      values((item->>'id')::uuid,owner_id,item->>'name',nullif(item->>'planned_on','')::date,item->>'notes')
      on conflict(id) do nothing returning id into saved_id;
    if saved_id is not null then
      insert into public.trip_list_summits(list_id,user_id,summit_id,position)
        select saved_id,owner_id,value,ordinal::int-1 from jsonb_array_elements_text(item->'summitIds') with ordinality as ids(value,ordinal);
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_goals) loop
    insert into public.journal_goals(user_id,year,metric,target) values(owner_id,(item->>'year')::int,item->>'metric',(item->>'target')::int) on conflict do nothing;
  end loop;
end; $$;
revoke all on function public.restore_backup_extras(text[],jsonb,jsonb,uuid) from public,anon;
grant execute on function public.restore_backup_extras(text[],jsonb,jsonb,uuid) to authenticated;
