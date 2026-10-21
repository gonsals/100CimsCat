import { NextRequest, NextResponse } from 'next/server'
import catalog from '@/data/summits.json'
import { matchingEntity, plainMetadata, safeCommonsPhoto, type SummitContext, type WikidataEntity } from '@/lib/summit-context'
import type { Language } from '@/lib/tracker'

export async function GET(request: NextRequest) {
  const summit = catalog.find(item => item.id === request.nextUrl.searchParams.get('id'))
  if (!summit) return NextResponse.json({ error: 'Unknown summit.' }, { status: 404 })
  const empty: SummitContext = { description: {}, photo: null }
  const signal = AbortSignal.timeout(12000)
  const headers = { Accept: 'application/json', 'User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)', 'Api-User-Agent': '100CimsCat/1.0 (https://100-cims-cat.vercel.app/)' }
  async function read(url: string, params: Record<string, string>) {
    const response = await fetch(`${url}?${new URLSearchParams({ format: 'json', maxlag: '5', ...params })}`, { headers, signal, next: { revalidate: 604800 } })
    if (!response.ok) throw new Error('Public data unavailable')
    const data = await response.json()
    if (data.error) throw new Error('Public data unavailable')
    return data
  }
  try {
    const search = await read('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: summit.name, language: 'ca', limit: '5', type: 'item' })
    const ids = (search.search ?? []).map((entity: { id: string }) => entity.id).filter((id: string) => /^Q\d+$/.test(id)).slice(0, 5)
    if (!ids.length) return NextResponse.json(empty, { headers: { 'Cache-Control': 'public, s-maxage=86400' } })
    const data = await read('https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|descriptions|claims', languages: 'ca|es|en' })
    const entity = matchingEntity(summit, Object.values(data.entities ?? {}) as WikidataEntity[])
    if (!entity) return NextResponse.json(empty, { headers: { 'Cache-Control': 'public, s-maxage=86400' } })
    const result: SummitContext = { ...empty, entityUrl: `https://www.wikidata.org/wiki/${entity.id}`, description: {} }
    for (const language of ['ca', 'es', 'en'] as Language[]) {
      const description = entity.descriptions?.[language]?.value
      if (description) result.description[language] = plainMetadata(description)
    }
    const image = entity.claims?.P18?.find(claim => claim.rank !== 'deprecated')?.mainsnak.datavalue?.value
    if (typeof image === 'string' && image.length < 300) {
      const commons = await read('https://commons.wikimedia.org/w/api.php', { action: 'query', titles: `File:${image}`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1280' })
      const pages = Object.values(commons.query?.pages ?? {}) as { imageinfo?: Parameters<typeof safeCommonsPhoto>[0][] }[]
      const info = pages[0]?.imageinfo?.[0]
      if (info) result.photo = safeCommonsPhoto(info)
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch {
    return NextResponse.json({ error: 'Public context temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
