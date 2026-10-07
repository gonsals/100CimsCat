-- Supabase projects may inherit ALL table privileges via default grants.
revoke all on public.summit_favorites from public, anon, authenticated;
grant select, insert, delete on public.summit_favorites to authenticated;
