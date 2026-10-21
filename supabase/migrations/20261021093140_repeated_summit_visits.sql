-- The original first-ascent table remains compatible with existing clients.
-- Repeated visits are independent records, each with its own private photo.
create table public.ascent_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summit_id text not null references public.summits(id) on delete cascade,
  completed_at date not null check (completed_at <= current_date),
  notes text not null default '' check (char_length(notes) <= 4000),
  photo_path text unique,
  created_at timestamptz not null default now(),
  constraint ascent_visits_photo_owner check (photo_path is null or starts_with(photo_path, user_id::text || '/' || summit_id || '/'))
);
create index ascent_visits_user_completed_idx on public.ascent_visits(user_id, completed_at desc);
create index ascent_visits_summit_idx on public.ascent_visits(summit_id);
alter table public.ascent_visits enable row level security;
revoke all on public.ascent_visits from public, anon, authenticated;
grant select, insert, update, delete on public.ascent_visits to authenticated;
create policy "Users read their own visits" on public.ascent_visits for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own visits" on public.ascent_visits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users edit their own visits" on public.ascent_visits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own visits" on public.ascent_visits for delete to authenticated using ((select auth.uid()) = user_id);

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
     where o.bucket_id = 'summit-photos'
       and (exists (select 1 from public.ascent_records a where a.user_id = current_user_id and a.photo_path = o.name)
         or exists (select 1 from public.ascent_visits v where v.user_id = current_user_id and v.photo_path = o.name))
       and o.name = p_replace_path
       and (storage.foldername(o.name))[1] = current_user_id::text
     limit 1;
    replace_size := coalesce(replace_size, 0);
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
