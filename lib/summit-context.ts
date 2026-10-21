import { coordinates, distanceKm, normalizeSearch, type Language, type Summit } from '@/lib/tracker'

export type PublicPhoto = { url: string; sourceUrl: string; author: string; license: string; licenseUrl: string }
export type SummitContext = { entityUrl?: string; description: Partial<Record<Language, string>>; photo: PublicPhoto | null }
export type WikidataEntity = { id: string; labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]>; descriptions?: Record<string, { value: string }>; claims?: Record<string, { rank?: string; mainsnak: { datavalue?: { value: unknown } } }[]> }
const ignoredWords = new Set(['de', 'del', 'dels', 'el', 'els', 'la', 'les', 'l', 'd', 'i'])
const identityName = (name: string) => normalizeSearch(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word && !ignoredWords.has(word)).join(' ')

export function matchingEntity(summit: Summit, entities: WikidataEntity[]): WikidataEntity | null {
  const point = coordinates[summit.id]
  if (!point) return null
  const targetName = identityName(summit.name)
  const matched = entities.filter(entity => {
    const names = [...Object.values(entity.labels ?? {}).map(label => label.value), ...Object.values(entity.aliases ?? {}).flat().map(alias => alias.value)]
    if (!names.some(name => identityName(name) === targetName)) return false
    const location = entity.claims?.P625?.find(claim => claim.rank !== 'deprecated')?.mainsnak.datavalue?.value as { latitude?: number; longitude?: number; globe?: string } | undefined
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || location.globe !== 'http://www.wikidata.org/entity/Q2') return false
    if (distanceKm(point, { lat: location.latitude, lng: location.longitude }) > 1) return false
    const elevation = entity.claims?.P2044?.find(claim => claim.rank !== 'deprecated')?.mainsnak.datavalue?.value as { amount?: string; unit?: string } | undefined
    return !elevation || (elevation.unit === 'http://www.wikidata.org/entity/Q11573' && Number.isFinite(Number(elevation.amount)) && Math.abs(Number(elevation.amount) - summit.height) <= 150)
  })
  // Ambiguous identities are not resolved by guessing which picture looks right.
  return matched.length === 1 ? matched[0] : null
}

export function plainMetadata(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }
    if (named[entity]) return named[entity]
    const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10)
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  }).replace(/\s+/g, ' ').trim().slice(0, 300)
}

export function safeCommonsPhoto(info: { thumburl?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }): PublicPhoto | null {
  const metadata = info.extmetadata ?? {}
  const author = plainMetadata(metadata.Artist?.value || metadata.Credit?.value || '')
  const license = plainMetadata(metadata.LicenseShortName?.value || '')
  if (!author || !/^(CC0(?: 1\.0)?|CC BY(?:-SA)? [1-4]\.0|Public domain)$/i.test(license)) return null
  try {
    const image = new URL(info.thumburl ?? '')
    const source = new URL(info.descriptionurl ?? '')
    const licenseUrl = new URL(metadata.LicenseUrl?.value?.replace(/^\/\//, 'https://') || source.href)
    if (image.protocol !== 'https:' || image.hostname !== 'upload.wikimedia.org' || !image.pathname.startsWith('/wikipedia/commons/')) return null
    if (source.protocol !== 'https:' || source.hostname !== 'commons.wikimedia.org' || !source.pathname.startsWith('/wiki/File:')) return null
    if (licenseUrl.protocol !== 'https:' || !['creativecommons.org', 'commons.wikimedia.org'].includes(licenseUrl.hostname)) return null
    if (info.mime && !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return null
    return { url: image.href, sourceUrl: source.href, author, license, licenseUrl: licenseUrl.href }
  } catch { return null }
}
