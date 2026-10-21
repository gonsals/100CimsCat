import type { Summit, Coordinate } from '@/lib/tracker'

export const offlineStorageKey = '100cimscat-offline-v1'
export type OfflineSummit = Summit & { coordinate?: Coordinate; savedAt: string }

export function readOfflineSummits(): OfflineSummit[] {
  const raw = localStorage.getItem(offlineStorageKey)
  if (!raw) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Invalid saved summits')
  return data.filter((item): item is OfflineSummit => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.region === 'string' && Number.isFinite(item.height) && typeof item.url === 'string'))
}

export async function prepareOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error('Offline unavailable')
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Offline preparation timed out')), 12000)),
  ])
  // A successful install means the worker has finished caching the offline reader.
}
