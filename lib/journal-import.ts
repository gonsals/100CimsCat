import { normalizeSearch, validAscentDate, type Ascent, type Summit } from '@/lib/tracker'

export type ImportPayload = { summit_id: string; completed_at: string | null; notes: string; favorite: boolean }
export type ImportPreview = { row: number; name: string; date: string; notes: string; favorite: boolean; status: 'ready' | 'favorite' | 'duplicate' | 'invalid'; reason: string; payload: ImportPayload | null }
export const csvByteLimit = 2 * 1024 * 1024
export const csvRowLimit = 2000

function delimiterFor(text: string) {
  let quoted = false, commas = 0, semicolons = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted }
    if (!quoted && (char === '\n' || char === '\r')) break
    if (!quoted && char === ',') commas++
    if (!quoted && char === ';') semicolons++
  }
  return semicolons > commas ? ';' : ','
}

function readCsv(text: string) {
  if (text.length > csvByteLimit) throw new Error('El fitxer supera el límit de 2 MB o 2.000 files.')
  if (text.includes('\0')) throw new Error('El fitxer no és un CSV vàlid.')
  const input = text.replace(/^\uFEFF/, ''), delimiter = delimiterFor(input)
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  const finishCell = () => { row.push(cell); cell = ''; closed = false }
  const finishRow = () => {
    finishCell()
    if (row.some(value => value.trim())) rows.push(row)
    row = []
    if (rows.length > csvRowLimit + 1) throw new Error('El fitxer supera el límit de 2 MB o 2.000 files.')
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char !== '"') cell += char
      else if (input[i + 1] === '"') { cell += '"'; i++ }
      else { quoted = false; closed = true }
    } else if (char === delimiter) finishCell()
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i++; finishRow() }
    else if (char === '"' && cell === '' && !closed) quoted = true
    else if (char === '"' || (closed && !/\s/.test(char))) throw new Error('El fitxer no és un CSV vàlid.')
    else if (!closed) cell += char
    if (row.length > 32) throw new Error('El fitxer no és un CSV vàlid.')
  }
  if (quoted) throw new Error('El fitxer no és un CSV vàlid.')
  finishRow()
  return rows
}

function importDate(value: string) {
  const text = value.trim()
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  return local ? `${local[3]}-${local[2]}-${local[1]}` : text
}

export function previewJournalCsv(text: string, summits: Summit[], visits: Ascent[], favorites: Set<string>): ImportPreview[] {
  const [header, ...rows] = readCsv(text)
  const headings = (header ?? []).map(value => normalizeSearch(value.replace(/_/g, ' ')))
  const column = (...aliases: string[]) => headings.findIndex(value => aliases.includes(value))
  const idColumn = column('id', 'summit id', 'cim id')
  const nameColumn = column('cim', 'cima', 'name', 'nom', 'nombre', 'summit')
  const dateColumn = column('data', 'fecha', 'date', 'completed at')
  const notesColumn = column('notes', 'notas', 'notes personals', 'notas personales')
  const favoriteColumn = column('preferit', 'favorito', 'favorite', 'favourite')
  const regionColumn = column('comarca', 'region')
  if ((idColumn < 0 && nameColumn < 0) || (dateColumn < 0 && favoriteColumn < 0) || new Set(headings).size !== headings.length) {
    throw new Error('El CSV ha de tenir capçaleres de cim i data o preferit.')
  }
  const ownExport = text.startsWith('\uFEFF') && headings.length === 8 && column('enllac feec', 'enlace feec', 'feec link') >= 0
  const byId = new Map(summits.map(summit => [summit.id, summit]))
  const byName = new Map<string, Summit[]>()
  for (const summit of summits) { const key = normalizeSearch(summit.name); byName.set(key, [...(byName.get(key) ?? []), summit]) }
  const seenVisits = new Set(visits.map(visit => `${visit.summit_id}|${visit.completed_at}`))
  const seenFavorites = new Set(favorites)
  return rows.map((values, index) => {
    const get = (column: number) => column < 0 ? '' : values[column] ?? ''
    const name = get(nameColumn).trim() || get(idColumn).trim()
    const date = importDate(get(dateColumn))
    // Undo only the formula-protection prefix added by our own CSV exporter.
    const notes = ownExport ? get(notesColumn).replace(/^'(?=\s*[=+@\-\t\r])/, '') : get(notesColumn)
    const favoriteText = normalizeSearch(get(favoriteColumn))
    const favorite = ['si', 'yes', 'true', '1'].includes(favoriteText)
    const candidates = get(idColumn).trim() ? [byId.get(get(idColumn).trim())].filter((item): item is Summit => Boolean(item)) : byName.get(normalizeSearch(name)) ?? []
    const region = normalizeSearch(get(regionColumn))
    const matches = region ? candidates.filter(summit => normalizeSearch(summit.region) === region) : candidates
    const summit = matches.length === 1 ? matches[0] : null
    let reason = ''
    if (values.length > headings.length) reason = 'La fila té més camps que la capçalera.'
    else if (!summit) reason = matches.length > 1 ? 'Nom ambigu: indica la comarca o l’identificador.' : 'No hem reconegut aquest cim.'
    else if (favoriteText && !['si', 'yes', 'true', '1', 'no', 'false', '0'].includes(favoriteText)) reason = 'El preferit ha de ser Sí o No.'
    else if (date && !validAscentDate(date)) reason = 'La data no és vàlida o és futura.'
    else if (!date && (!favorite || notes.trim())) reason = 'Cal una data per importar una ascensió amb notes.'
    else if (notes.length > 4000) reason = 'Les notes superen els 4.000 caràcters.'
    const base = { row: index + 2, name: summit?.name ?? name, date, notes, favorite }
    if (reason || !summit) return { ...base, status: 'invalid' as const, reason, payload: null }
    const duplicate = Boolean(date && seenVisits.has(`${summit.id}|${date}`))
    const addFavorite = favorite && !seenFavorites.has(summit.id)
    if (date) seenVisits.add(`${summit.id}|${date}`)
    if (favorite) seenFavorites.add(summit.id)
    const status = date && !duplicate ? 'ready' : addFavorite ? 'favorite' : 'duplicate'
    return { ...base, status: status as ImportPreview['status'], reason: status === 'duplicate' ? 'Ja existeix al quadern o al fitxer.' : status === 'favorite' ? 'Només s’afegirà el preferit.' : '', payload: { summit_id: summit.id, completed_at: date || null, notes, favorite } }
  })
}
