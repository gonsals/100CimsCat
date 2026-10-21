import artwork from '@/data/mountain-art.json'
import type { Language } from '@/lib/tracker'

type MountainArtwork = { file: string; bearing: number; sources: string[]; resolution: number }
const records = artwork as Record<string, MountainArtwork>

export function mountainArtwork(id: string): MountainArtwork | null { return records[id] ?? null }
export function mountainView(bearing: number, language: Language) {
  const labels = {
    ca: ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-oest', 'oest', 'nord-oest'],
    es: ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'],
    en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
  }
  return labels[language][Math.round(((bearing % 360 + 360) % 360) / 45) % 8]
}
