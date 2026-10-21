import { defaultFilters, type CatalogFilter, type Coordinate, type SortBy } from '@/lib/tracker'

export const catalogStateKey = '100cimscat-catalog-v1'
export type CatalogState = { version: 1; search: string; filters: CatalogFilter; sortBy: SortBy; view: 'list' | 'map'; limit: number; scrollY: number; origin: Coordinate | null; originLabel: string }
export const catalogSignature = (filters: CatalogFilter, search: string, sortBy: SortBy, origin: Coordinate | null) => JSON.stringify({ filters, search, sortBy, origin })

export function parseCatalogState(raw: string | null): CatalogState | null {
  try {
    if (!raw) return null
    const value = JSON.parse(raw)
    if (value.version !== 1 || typeof value.search !== 'string' || !value.filters) return null
    const f = value.filters
    const filters: CatalogFilter = {
      status: ['all', 'pending', 'done'].includes(f.status) ? f.status : 'all',
      essential: f.essential === true, favorites: f.favorites === true,
      region: typeof f.region === 'string' ? f.region.slice(0, 100) : '',
      minHeight: typeof f.minHeight === 'string' && /^\d{0,4}$/.test(f.minHeight) ? f.minHeight : defaultFilters.minHeight,
      maxHeight: typeof f.maxHeight === 'string' && /^\d{0,4}$/.test(f.maxHeight) ? f.maxHeight : defaultFilters.maxHeight,
    }
    const point = value.origin
    const origin = point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 ? { lat: point.lat, lng: point.lng } : null
    const sortBy = ['name', 'height', 'height-asc', 'distance'].includes(value.sortBy) ? value.sortBy as SortBy : 'name'
    return { version: 1, search: value.search.slice(0, 200), filters, sortBy: sortBy === 'distance' && !origin ? 'name' : sortBy, view: value.view === 'map' ? 'map' : 'list', limit: Number.isFinite(value.limit) ? Math.max(48, Math.min(1000, Math.floor(value.limit))) : 48, scrollY: Number.isFinite(value.scrollY) ? Math.max(0, Math.min(100000, value.scrollY)) : 0, origin, originLabel: typeof value.originLabel === 'string' ? value.originLabel.slice(0, 150) : '' }
  } catch { return null }
}
