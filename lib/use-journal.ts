'use client'

import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadJournal, type JournalData } from '@/lib/journal-data'
import type { Ascent } from '@/lib/tracker'

type JournalState = JournalData & { userId: string | null; ready: boolean; error: boolean }
const emptyJournal = (userId: string | null): JournalState => ({ userId, visits: [], favorites: new Set(), ready: false, error: false })

export function useJournal(supabase: SupabaseClient | null, userId: string | null) {
  const [state, setState] = useState(() => emptyJournal(userId))
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    setState(emptyJournal(userId))
    if (!supabase || !userId) return
    void loadJournal(supabase, userId, () => active).then(data => {
      if (active && data) setState({ ...data, userId, ready: true, error: false })
    }).catch(() => {
      if (active) setState(previous => ({ ...previous, error: true }))
    })
    return () => { active = false }
  }, [supabase, userId, version])

  // A late mutation from a previous account cannot update the current journal.
  const setVisits = useCallback((update: SetStateAction<Ascent[]>) => {
    setState(previous => previous.userId === userId
      ? { ...previous, visits: typeof update === 'function' ? update(previous.visits) : update }
      : previous)
  }, [userId])
  const setFavorites = useCallback((update: SetStateAction<Set<string>>) => {
    setState(previous => previous.userId === userId
      ? { ...previous, favorites: typeof update === 'function' ? update(previous.favorites) : update }
      : previous)
  }, [userId])
  const reload = useCallback(() => setVersion(previous => previous + 1), [])
  const replace = useCallback((data: JournalData) => setState(previous => previous.userId === userId ? { ...data, userId, ready: true, error: false } : previous), [userId])
  const current = state.userId === userId
  return {
    visits: current ? state.visits : [], favorites: current ? state.favorites : new Set<string>(),
    ready: current && state.ready, error: current && state.error, setVisits, setFavorites, reload, replace,
  }
}
