import coordinateSeed from '@/data/summit-coordinates.json'

export type Language = 'ca' | 'es' | 'en'
export type Summit = { id: string; name: string; height: number; region: string; essential: boolean; url: string }
export type Ascent = { summit_id: string; completed_at: string; photo_path: string | null; notes?: string; photoUrl?: string }
export type Coordinate = { lat: number; lng: number }
export type SortBy = 'name' | 'height' | 'height-asc' | 'distance'
export type CatalogFilter = { status: 'all' | 'pending' | 'done'; essential: boolean; favorites: boolean; region: string; minHeight: string; maxHeight: string }
export const defaultFilters: CatalogFilter = { status: 'all', essential: false, favorites: false, region: '', minHeight: '', maxHeight: '' }
export const coordinates = coordinateSeed as Record<string, Coordinate>
export const localeFor = (language: Language) => language === 'es' ? 'es-ES' : language === 'en' ? 'en-GB' : 'ca-ES'
export const regionsOf = (summit: Summit) => summit.region.split(',').map(region => region.trim()).filter(Boolean)

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ca').replace(/[’'·-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const radians = (value: number) => value * Math.PI / 180
  const dLat = radians(b.lat - a.lat)
  const dLng = radians(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function filterCatalog(summits: Summit[], ascents: Map<string, Ascent>, favorites: Set<string>, filters: CatalogFilter, search: string, sortBy: SortBy, origin: Coordinate | null) {
  const words = normalizeSearch(search).split(' ').filter(Boolean)
  const distances = new Map(summits.map(summit => [summit.id, origin && coordinates[summit.id] ? distanceKm(origin, coordinates[summit.id]) : Infinity]))
  return summits.filter(summit => {
    const done = ascents.has(summit.id)
    if (filters.status === 'done' && !done || filters.status === 'pending' && done) return false
    if (filters.essential && !summit.essential || filters.favorites && !favorites.has(summit.id)) return false
    if (filters.region && !regionsOf(summit).includes(filters.region)) return false
    if (filters.minHeight && summit.height < Number(filters.minHeight) || filters.maxHeight && summit.height > Number(filters.maxHeight)) return false
    const text = normalizeSearch(`${summit.name} ${summit.region}`)
    return words.every(word => text.includes(word))
  }).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'ca')
    if (sortBy === 'height') return b.height - a.height || byName
    if (sortBy === 'height-asc') return a.height - b.height || byName
    if (sortBy === 'distance' && origin) return (distances.get(a.id)! - distances.get(b.id)!) || byName
    return byName
  })
}

export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function validAscentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= localDate()
}

export function friendlyDate(value: string, language: Language) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short', year: 'numeric' })
}

// Quoting alone does not prevent spreadsheet formulas when a CSV is opened in Excel.
export function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function journalCsv(summits: Summit[], ascents: Map<string, Ascent>, favorites: Set<string>, headings: string[], yes: string, no: string) {
  const rows = summits.filter(summit => ascents.has(summit.id) || favorites.has(summit.id)).map(summit => {
    const ascent = ascents.get(summit.id)
    return [summit.name, summit.region, summit.height, summit.essential ? yes : no, ascent?.completed_at ?? '', ascent?.notes ?? '', favorites.has(summit.id) ? yes : no, summit.url].map(csvCell).join(';')
  })
  return '\uFEFF' + [headings.map(csvCell).join(';'), ...rows].join('\r\n')
}
