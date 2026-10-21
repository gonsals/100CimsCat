'use client'
import { useEffect, useState } from 'react'
import type { SummitContext } from '@/lib/summit-context'
import type { Summit } from '@/lib/tracker'

export function useSummitContext(summit: Summit) {
  const [data, setData] = useState<SummitContext | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 20000)
    setLoading(true); setError(false); setData(null)
    async function load(): Promise<SummitContext> {
      try {
        const response = await fetch(`/api/summit-context?id=${encodeURIComponent(summit.id)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Unavailable')
        return await response.json() as SummitContext
      } catch (error) { if (controller.signal.aborted) throw error }
      const { resolveSummitContext } = await import('@/lib/fetch-summit-context')
      return resolveSummitContext(summit, async (url, params) => {
        const response = await fetch(`${url}?${new URLSearchParams({ format: 'json', origin: '*', maxlag: '5', ...params })}`, { credentials: 'omit', signal: controller.signal })
        if (!response.ok) throw new Error('Public data unavailable')
        const result = await response.json()
        if (result.error) throw new Error('Public data unavailable')
        return result
      })
    }
    void load().then(result => { if (active) setData(result) }).catch(() => { if (active) setError(true) }).finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [summit, version])
  return { data, error, loading, retry: () => setVersion(previous => previous + 1) }
}
