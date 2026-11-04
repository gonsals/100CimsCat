'use client'
import { useMemo, useRef, useState } from 'react'
import FeatureDialog from '@/components/FeatureDialog'
import { csvByteLimit, previewJournalCsv, type ImportPayload } from '@/lib/journal-import'
import { planningText } from '@/lib/planning-i18n'
import type { ImportResult } from '@/lib/trip-planning'
import type { Ascent, Language, Summit } from '@/lib/tracker'

type Props = { summits: Summit[]; visits: Ascent[]; favorites: Set<string>; language: Language; onImport: (rows: ImportPayload[]) => Promise<ImportResult> }

function ImportDialog({ summits, visits, favorites, language, onImport, onClose }: Props & { onClose: () => void }) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(50)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const readVersion = useRef(0)
  const t = (value: string) => planningText(language, value)
  const preview = useMemo(() => { try { return { rows: text ? previewJournalCsv(text, summits, visits, favorites) : [], error: '' } } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'El fitxer no és un CSV vàlid.' } } }, [text, summits, visits, favorites])
  const available = preview.rows.filter(row => row.status === 'ready' || row.status === 'favorite')
  const chosen = available.filter(row => selected.has(row.row))
  async function chooseFile(file?: File) {
    if (!file) return
    const version = ++readVersion.current
    setError(''); setResult(null); setText(''); setSelected(new Set()); setReading(true); setLimit(50)
    try {
      if (file.size > csvByteLimit) throw new Error('El fitxer supera el límit de 2 MB o 2.000 files.')
      const content = await file.text()
      if (version !== readVersion.current) return
      const rows = previewJournalCsv(content, summits, visits, favorites)
      setText(content)
      setSelected(new Set(rows.filter(row => row.status === 'ready' || row.status === 'favorite').map(row => row.row)))
    } catch (error) { if (version === readVersion.current) setError(error instanceof Error ? error.message : 'No s’ha pogut llegir el fitxer.') }
    finally { if (version === readVersion.current) setReading(false) }
  }
  async function submit() {
    if (busy || !chosen.length) return
    setBusy(true); setError('')
    try { setResult(await onImport(chosen.flatMap(row => row.payload ? [row.payload] : []))) }
    catch { setError('No s’ha pogut importar. Pots reintentar-ho sense duplicar les visites.') }
    finally { setBusy(false) }
  }
  return <FeatureDialog title={t('Importar ascensions')} closeLabel={t('Tancar')} busy={busy} onClose={onClose}>
    {result ? <div role="status" className="import-result"><h3>{t('Importació completada')}</h3><p>{t('Ascensions afegides')}: <strong>{result.visits.length}</strong></p><p>{t('Preferits afegits')}: <strong>{result.favorites.length}</strong></p><p>{t('Visites duplicades omeses')}: <strong>{result.skipped}</strong></p><button className="primary-button" type="button" onClick={onClose}>{t('Tancar')}</button></div> : <>
      <p className="field-hint">{t('Revisa les files abans de desar. Les ascensions existents no se sobreescriuen.')}</p>
      <label className="feature-field">{t('Fitxer CSV')}<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
      <p className="field-hint">{t('CSV UTF-8 amb coma o punt i coma. Capçaleres: Cim, Data, Notes i Preferit. Dates AAAA-MM-DD o DD/MM/AAAA. Màxim 2 MB i 2.000 files.')}</p>
      {(error || preview.error) && <p className="form-error" role="alert">{t(error || preview.error)}</p>}
      {reading && <p role="status">…</p>}
      {text && !preview.error && <>
        <div className="import-summary" role="status">{['ready', 'favorite', 'duplicate', 'invalid'].map((status, index) => <span key={status}>{t(['Preparada', 'Només preferit', 'Duplicada', 'Amb errors'][index])}: <strong>{preview.rows.filter(row => row.status === status).length}</strong></span>)}</div>
        {available.length > 0 && <label className="import-select-all"><input type="checkbox" disabled={busy} checked={chosen.length === available.length} onChange={event => setSelected(event.target.checked ? new Set(available.map(row => row.row)) : new Set())} />{t('Seleccionar les files vàlides')}</label>}
        <div className="import-table-wrap"><table className="import-table"><caption>{t('Files seleccionades')}: {chosen.length}</caption><thead><tr><th>{t('Fila')}</th><th>{t('Cim')}</th><th>{t('Data')}</th><th>{t('Estat')}</th></tr></thead><tbody>{preview.rows.slice(0, limit).map(row => <tr key={row.row}>
          <td><label><input type="checkbox" aria-label={`${t('Seleccionar fila')} ${row.row}`} disabled={busy || !['ready', 'favorite'].includes(row.status)} checked={selected.has(row.row) && ['ready', 'favorite'].includes(row.status)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(row.row); else next.delete(row.row); return next })} />{row.row}</label></td>
          <td><strong>{row.name}</strong>{row.notes && <details><summary>{t('Notes personals')}</summary><p>{row.notes}</p></details>}</td><td>{row.date || '—'}</td><td>{t(({ ready: 'Preparada', favorite: 'Només preferit', duplicate: 'Duplicada', invalid: 'Amb errors' })[row.status])}{row.reason && <small>{t(row.reason)}</small>}</td>
        </tr>)}</tbody></table></div>
        {!preview.rows.length && <p>{t('No hi ha files per importar.')}</p>}
        {preview.rows.length > limit && <button className="secondary-button" type="button" onClick={() => setLimit(previous => previous + 50)}>{t('Veure més files')}</button>}
      </>}
      <div className="feature-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>{t('Cancel·lar')}</button><button className="primary-button" type="button" disabled={busy || reading || !chosen.length} onClick={() => void submit()}>{busy ? '…' : `${t('Importar CSV')} (${chosen.length})`}</button></div>
    </>}
  </FeatureDialog>
}
export default function JournalImport(props: Props) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="secondary-button" onClick={() => setOpen(true)}>{planningText(props.language, 'Importar CSV')}</button>{open && <ImportDialog {...props} onClose={() => setOpen(false)} />}</>
}
