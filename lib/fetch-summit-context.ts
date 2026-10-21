import { matchingEntity, plainMetadata, safeCommonsPhoto, type SummitContext, type WikidataEntity } from '@/lib/summit-context'
import type { Language, Summit } from '@/lib/tracker'

type Reader = (url: string, params: Record<string, string>) => Promise<any>

// Both transports use the same identity and license checks. The browser fallback
// reads public MediaWiki data anonymously; journal data never enters this flow.
export async function resolveSummitContext(summit: Summit, read: Reader): Promise<SummitContext> {
  const empty: SummitContext = { description: {}, photo: null }
  const search = await read('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: summit.name, language: 'ca', limit: '5', type: 'item' })
  const ids = (search.search ?? []).map((entity: { id: string }) => entity.id).filter((id: string) => /^Q\d+$/.test(id)).slice(0, 5)
  if (!ids.length) return empty
  const data = await read('https://www.wikidata.org/w/api.php', { action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|descriptions|claims', languages: 'ca|es|en' })
  const entity = matchingEntity(summit, Object.values(data.entities ?? {}) as WikidataEntity[])
  if (!entity) return empty
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
  return result
}
