import type { SupabaseClient } from '@supabase/supabase-js'
import { ascentKey, type Ascent } from '@/lib/tracker'
import { validateTrack, type TrackData } from '@/lib/gpx'
export type VisitTrack = {
  visit_key: string
  summit_id: string
  filename: string
  data: TrackData
}
export async function saveTrack(
  client: SupabaseClient,
  userId: string,
  visit: Ascent,
  filename: string,
  data: TrackData,
  keepExisting = false,
) {
  const { error } = await client
    .from('visit_tracks')
    .upsert(
      {
        user_id: userId,
        visit_key: ascentKey(visit),
        summit_id: visit.summit_id,
        visit_id: visit.id ?? null,
        first_summit_id: visit.id ? null : visit.summit_id,
        filename: filename.slice(0, 120) || 'route.gpx',
        data: validateTrack(data),
      },
      { onConflict: 'user_id,visit_key', ignoreDuplicates: keepExisting },
    )
  if (error) throw error
}
export async function loadTracks(
  client: SupabaseClient,
  userId: string,
): Promise<VisitTrack[]> {
  const rows: VisitTrack[] = []
  for (let from = 0; ; from += 100) {
    const { data, error } = await client
      .from('visit_tracks')
      .select('visit_key,summit_id,filename,data')
      .eq('user_id', userId)
      .order('visit_key')
      .range(from, from + 99)
    if (error) throw error
    rows.push(...(data as VisitTrack[]))
    if (data.length < 100) return rows
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
