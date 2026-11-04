import type { Language } from '@/lib/tracker'

const labels = {
  record: ['Registrar sortida', 'Registrar salida', 'Record outing'],
  choose: ['Tria el cim', 'Elige la cima', 'Choose a summit'],
  searchSummit: [
    'Cercar per nom o comarca',
    'Buscar por nombre o comarca',
    'Search by name or region',
  ],
  recent: ['Cims recents', 'Cimas recientes', 'Recent summits'],
  hint: [
    'Escriu per trobar qualsevol cim del catàleg.',
    'Escribe para encontrar cualquier cima del catálogo.',
    'Type to find any summit in the catalogue.',
  ],
  noMatch: [
    'No hem trobat cap cim. Prova un altre nom o comarca.',
    'No encontramos ninguna cima. Prueba otro nombre o comarca.',
    'No summits found. Try another name or region.',
  ],
  close: ['Tancar', 'Cerrar', 'Close'],
  searchJournal: [
    'Cercar al quadern',
    'Buscar en el cuaderno',
    'Search journal',
  ],
  searchHint: [
    'Cim, comarca o notes',
    'Cima, comarca o notas',
    'Summit, region or notes',
  ],
  noVisits: [
    'No hi ha sortides amb aquesta cerca i any.',
    'No hay salidas con esta búsqueda y año.',
    'No outings match this search and year.',
  ],
  clear: ['Netejar cerca', 'Limpiar búsqueda', 'Clear search'],
  tools: ['Eines del quadern', 'Herramientas del cuaderno', 'Journal tools'],
} as const
export const journalUiText = (language: Language, key: keyof typeof labels) =>
  labels[key][language === 'ca' ? 0 : language === 'es' ? 1 : 2]
