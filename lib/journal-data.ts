import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ascent } from '@/lib/tracker'

export type JournalData = { visits: Ascent[]; favorites: Set<string> }

// Stop paginating after the component has left or the account has changed.
export async function loadJournal(supabase: SupabaseClient, userId: string, isActive: () => boolean, includePhotoUrls = true): Promise<JournalData | null> {
  async function loadRepeatedVisits() {
    const rows: Ascent[] = []
    for (let from = 0; isActive(); from += 500) {
      const { data, error } = await supabase.from('ascent_visits')
        .select('id,summit_id,completed_at,photo_path,notes,created_at')
        .eq('user_id', userId).order('completed_at', { ascending: false }).order('id').range(from, from + 499)
      if (!isActive()) return null
      if (error) throw error
      rows.push(...data as Ascent[])
      if (data.length < 500) return rows
    }
    return null
  }

  const [first, favorites, repeated] = await Promise.all([
    supabase.from('ascent_records').select('summit_id,completed_at,photo_path,notes,created_at').eq('user_id', userId),
    supabase.from('summit_favorites').select('summit_id').eq('user_id', userId),
    loadRepeatedVisits(),
  ])
  if (!isActive() || repeated === null) return null
  if (first.error || favorites.error) throw first.error ?? favorites.error
  const visits = [...(first.data ?? []), ...repeated] as Ascent[]
  const paths = visits.flatMap(visit => visit.photo_path ? [visit.photo_path] : [])
  const signed = includePhotoUrls && paths.length
    ? await supabase.storage.from('summit-photos').createSignedUrls(paths, 60 * 60 * 24)
    : { data: [] }
  if (!isActive()) return null
  const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]))
  return {
    visits: visits.map(visit => ({ ...visit, photoUrl: visit.photo_path ? urls.get(visit.photo_path) ?? undefined : undefined })),
    favorites: new Set((favorites.data ?? []).map(row => row.summit_id as string)),
  }
}
