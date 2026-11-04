import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ascent } from '@/lib/tracker'
import type { ImportPayload } from '@/lib/journal-import'

export type TripList = { id: string; name: string; planned_on: string | null; notes: string; summitIds: string[] }
export type ImportResult = { visits: Ascent[]; favorites: string[]; skipped: number }

export async function loadTripLists(supabase: SupabaseClient, userId: string, isActive: () => boolean): Promise<TripList[]> {
  const lists: TripList[] = []
  for (let from = 0; isActive(); from += 100) {
    const { data, error } = await supabase.from('trip_lists').select('id,name,planned_on,notes,trip_list_summits(summit_id,position)')
      .eq('user_id', userId).order('created_at').order('id').range(from, from + 99)
    if (!isActive()) return []
    if (error) throw error
    lists.push(...data.map(row => ({ id: row.id, name: row.name, planned_on: row.planned_on, notes: row.notes,
      summitIds: [...row.trip_list_summits].sort((a, b) => a.position - b.position).map(item => item.summit_id) })))
    if (data.length < 100) break
  }
  return lists
}

export async function saveTripList(supabase: SupabaseClient, list: TripList, userId: string): Promise<TripList> {
  const { data, error } = await supabase.rpc('save_trip_list', { p_id: list.id, p_name: list.name.trim(), p_planned_on: list.planned_on, p_notes: list.notes, p_summits: list.summitIds, p_expected_user: userId })
  if (error || data !== list.id) throw error ?? new Error('List unavailable')
  return { ...list, name: list.name.trim() }
}

export async function importJournal(supabase: SupabaseClient, rows: ImportPayload[], userId: string): Promise<ImportResult> {
  const { data, error } = await supabase.rpc('import_journal', { p_rows: rows, p_expected_user: userId })
  if (error) throw error
  if (!data || !Array.isArray(data.visits) || !Array.isArray(data.favorites) || typeof data.skipped !== 'number') throw new Error('Import unavailable')
  return data as ImportResult
}
