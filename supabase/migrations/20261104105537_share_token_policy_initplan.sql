-- Read the request header once per statement, not once per visible row.
alter policy "A share token grants public read" on public.shared_trips
  using (expires_at>now() and token::text=(select nullif(current_setting('request.headers',true),'')::jsonb->>'x-share-token'));
