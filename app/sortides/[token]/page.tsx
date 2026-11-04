import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import catalog from '@/data/summits.json'
import SharedTripContent from '@/components/SharedTripContent'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Sortida compartida · 100CimsCat',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export default async function SharedTrip({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      token,
    )
  )
    notFound()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) notFound()
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-share-token': token.toLowerCase() },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
  const { data, error } = await client
    .from('shared_trips')
    .select('title,planned_on,summit_ids,expires_at')
    .eq('token', token.toLowerCase())
    .maybeSingle()
  if (error || !data) notFound()
  return (
    <SharedTripContent
      title={data.title}
      date={data.planned_on}
      summits={(data.summit_ids as string[]).flatMap((id) => {
        const summit = catalog.find((s) => s.id === id)
        return summit ? [summit] : []
      })}
    />
  )
}
