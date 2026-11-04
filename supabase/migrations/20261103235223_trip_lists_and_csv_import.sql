-- Planning and imports are private to the caller. Existing ascents and photos
-- are never replaced by these operations. Both RPCs run with caller privileges.
create table public.trip_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  planned_on date check (planned_on is null or isfinite(planned_on)),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index trip_lists_user_created_idx on public.trip_lists(user_id, created_at, id);
create table public.trip_list_summits (
  list_id uuid not null,
  user_id uuid not null,
  summit_id text not null references public.summits(id) on delete cascade,
  position integer not null check (position between 0 and 521),
  primary key (list_id, summit_id),
  foreign key (list_id, user_id) references public.trip_lists(id, user_id) on delete cascade
);
create index trip_list_summits_user_idx on public.trip_list_summits(user_id);
create index trip_list_summits_list_owner_idx on public.trip_list_summits(list_id, user_id);
create index trip_list_summits_summit_idx on public.trip_list_summits(summit_id);
alter table public.trip_lists enable row level security;
alter table public.trip_list_summits enable row level security;
revoke all on public.trip_lists, public.trip_list_summits from public, anon, authenticated;
grant select, insert, update, delete on public.trip_lists, public.trip_list_summits to authenticated;
create policy "Owners manage trip lists" on public.trip_lists for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners manage trip summits" on public.trip_list_summits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_trip_list(p_id uuid, p_name text, p_planned_on date, p_notes text, p_summits text[], p_expected_user uuid default auth.uid())
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
  summit_ids text[] := coalesce(p_summits, '{}'::text[]);
begin
  if owner_id is null or owner_id is distinct from p_expected_user then raise insufficient_privilege using message = 'Authentication required'; end if;
  if cardinality(summit_ids) > 522 or array_position(summit_ids, null) is not null
     or cardinality(summit_ids) <> (select count(distinct s) from unnest(summit_ids) s) then
    raise invalid_parameter_value using message = 'Invalid summit selection';
  end if;
  insert into public.trip_lists(id, user_id, name, planned_on, notes)
  values (coalesce(p_id, gen_random_uuid()), owner_id, btrim(p_name), p_planned_on, coalesce(p_notes, ''))
  on conflict (id) do update set name = excluded.name, planned_on = excluded.planned_on, notes = excluded.notes
    where trip_lists.user_id = owner_id
  returning id into saved_id;
  if saved_id is null then raise insufficient_privilege using message = 'List unavailable'; end if;
  delete from public.trip_list_summits where list_id = saved_id and user_id = owner_id;
  insert into public.trip_list_summits(list_id, user_id, summit_id, position)
    select saved_id, owner_id, summit_id, ordinal::integer - 1
    from unnest(summit_ids) with ordinality as selected(summit_id, ordinal);
  return saved_id;
end;
$$;
revoke all on function public.save_trip_list(uuid, text, date, text, text[], uuid) from public, anon;
grant execute on function public.save_trip_list(uuid, text, date, text, text[], uuid) to authenticated;

create index ascent_visits_user_summit_date_idx on public.ascent_visits(user_id, summit_id, completed_at);
create function public.import_journal(p_rows jsonb, p_expected_user uuid default auth.uid())
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  summit text;
  visit_date date;
  visit_notes text;
  favorite boolean;
  saved public.ascent_visits%rowtype;
  imported jsonb := '[]'::jsonb;
  added_favorites jsonb := '[]'::jsonb;
  affected integer;
  skipped integer := 0;
begin
  if owner_id is null or owner_id is distinct from p_expected_user then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise invalid_parameter_value using message = 'Import must contain between 1 and 2000 rows';
  end if;
  -- Serializes retries and concurrent imports for this account only.
  perform pg_advisory_xact_lock(hashtextextended('100cimscat-import:' || owner_id::text, 0));
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item -> 'summit_id') is distinct from 'string'
       or (item ? 'notes' and jsonb_typeof(item -> 'notes') is distinct from 'string')
       or (item ? 'favorite' and jsonb_typeof(item -> 'favorite') is distinct from 'boolean') then
      raise invalid_parameter_value using message = 'Invalid import row';
    end if;
    summit := item ->> 'summit_id';
    visit_notes := coalesce(item ->> 'notes', '');
    favorite := coalesce((item ->> 'favorite')::boolean, false);
    if char_length(visit_notes) > 4000 or not exists(select 1 from public.summits where id = summit) then
      raise invalid_parameter_value using message = 'Invalid summit or notes';
    end if;
    visit_date := null;
    if nullif(item ->> 'completed_at', '') is not null then
      if (item ->> 'completed_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise invalid_parameter_value using message = 'Use ISO dates';
      end if;
      visit_date := (item ->> 'completed_at')::date;
      if visit_date > current_date then raise invalid_parameter_value using message = 'Future visit'; end if;
    elsif not favorite or visit_notes <> '' then
      raise invalid_parameter_value using message = 'A visit date is required for notes';
    end if;
    if visit_date is not null then
      insert into public.ascent_visits(user_id, summit_id, completed_at, notes)
      select owner_id, summit, visit_date, visit_notes
      where not exists(select 1 from public.ascent_records a where a.user_id = owner_id and a.summit_id = summit and a.completed_at = visit_date)
        and not exists(select 1 from public.ascent_visits a where a.user_id = owner_id and a.summit_id = summit and a.completed_at = visit_date)
      returning * into saved;
      if found then imported := imported || jsonb_build_array(to_jsonb(saved) - 'user_id');
      else skipped := skipped + 1; end if;
    end if;
    if favorite then
      insert into public.summit_favorites(user_id, summit_id) values (owner_id, summit) on conflict do nothing;
      get diagnostics affected = row_count;
      if affected = 1 then added_favorites := added_favorites || jsonb_build_array(summit); end if;
    end if;
  end loop;
  return jsonb_build_object('visits', imported, 'favorites', added_favorites, 'skipped', skipped);
end;
$$;
revoke all on function public.import_journal(jsonb, uuid) from public, anon;
grant execute on function public.import_journal(jsonb, uuid) to authenticated;
