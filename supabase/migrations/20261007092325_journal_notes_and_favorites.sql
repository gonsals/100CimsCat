 -- Private journal notes and planned summits.
alter table public.ascent_records add column notes text not null default '';
alter table public.ascent_records add constraint ascent_records_notes_length check (char_length(notes) <= 4000);

create table public.summit_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  summit_id text not null references public.summits(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, summit_id)
);
create index summit_favorites_summit_id_idx on public.summit_favorites (summit_id);
alter table public.summit_favorites enable row level security;
grant select, insert, delete on public.summit_favorites to authenticated;
create policy "Users can read their own favorites" on public.summit_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own favorites" on public.summit_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete their own favorites" on public.summit_favorites for delete to authenticated using ((select auth.uid()) = user_id);
