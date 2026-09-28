-- Covers summit_id foreign-key checks when catalog rows are updated or deleted.
create index if not exists ascent_records_summit_id_idx
  on public.ascent_records (summit_id);

