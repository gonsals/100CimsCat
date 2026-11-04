'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Account = { id: string; email?: string }

export function useAccount(supabase: SupabaseClient | null) {
  const [user, setUser] = useState<Account | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!supabase) { setReady(true); return }
    let active = true
    let sessionChanged = false
    void supabase.auth.getUser().then(({ data }) => {
      if (active && !sessionChanged) setUser(data.user ? { id: data.user.id, email: data.user.email } : null)
    }).catch(() => {
      if (active && !sessionChanged) setUser(null)
    }).finally(() => { if (active) setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (_event === 'SIGNED_OUT') void import('@/public/journal-store').then(store => store.setOwner(null)).catch(() => {})
      sessionChanged = true
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      setReady(true)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [supabase])
  return { user, setUser, ready }
}
