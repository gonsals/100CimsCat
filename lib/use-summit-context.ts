'use client'
import { useEffect, useState } from 'react'
import type { SummitContext } from '@/lib/summit-context'

export function useSummitContext(id: string) {
  const [data, setData] = useState<SummitContext | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(false); setData(null)
    fetch(`/api/summit-context?id=${encodeURIComponent(id)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unavailable')
      return response.json() as Promise<SummitContext>
    }).then(result => { if (!controller.signal.aborted) setData(result) }).catch(() => { if (!controller.signal.aborted) setError(true) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, version])
  return { data, error, loading, retry: () => setVersion(previous => previous + 1) }
}
