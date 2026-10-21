import { NextRequest, NextResponse } from 'next/server'
import catalog from '@/data/summits.json'
import { resolveSummitContext } from '@/lib/fetch-summit-context'

export async function GET(request: NextRequest) {
  const summit = catalog.find(item => item.id === request.nextUrl.searchParams.get('id'))
  if (!summit) return NextResponse.json({ error: 'Unknown summit.' }, { status: 404 })
  const signal = AbortSignal.timeout(12000)
  const headers = { Accept: 'application/json', 'User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)', 'Api-User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)' }
  async function read(url: string, params: Record<string, string>) {
    const response = await fetch(`${url}?${new URLSearchParams({ format: 'json', maxlag: '5', ...params })}`, { headers, signal, next: { revalidate: 604800 } })
    if (!response.ok) { console.warn('Public summit context upstream unavailable', new URL(url).hostname, response.status); throw new Error('Public data unavailable') }
    const data = await response.json()
    if (data.error) throw new Error('Public data unavailable')
    return data
  }
  try {
    const result = await resolveSummitContext(summit, read)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch {
    return NextResponse.json({ error: 'Public context temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
