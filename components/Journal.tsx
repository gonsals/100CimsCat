'use client'

import { useMemo, useState } from 'react'
import { ascentKey, friendlyDate, journalCsv, regionsOf, type Ascent, type Language, type Summit } from '@/lib/tracker'
import PhotoViewer, { PrivatePhoto } from '@/components/PhotoViewer'
import Icon from '@/components/Icon'

type Props = { summits: Summit[]; ascents: Map<string, Ascent>; visits: Ascent[]; favorites: Set<string>; language: Language; t: (value: string) => string; onEdit: (summit: Summit, ascent: Ascent) => void; onRefreshPhoto: (ascent: Ascent) => Promise<void> }

export default function Journal({ summits, ascents, visits, favorites, language, t, onEdit, onRefreshPhoto }: Props) {
  const [year, setYear] = useState('')
  const [limit, setLimit] = useState(8)
  const [view, setView] = useState<'history' | 'gallery'>('history')
  const [photoLimit, setPhotoLimit] = useState(24)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const entries = useMemo(() => {
    const byId = new Map(summits.map(summit => [summit.id, summit]))
    return visits.flatMap(ascent => { const summit = byId.get(ascent.summit_id); return summit ? [{ summit, ascent }] : [] })
      .sort((a, b) => b.ascent.completed_at.localeCompare(a.ascent.completed_at) || (b.ascent.created_at ?? '').localeCompare(a.ascent.created_at ?? '') || a.summit.name.localeCompare(b.summit.name))
  }, [summits, visits])
  const years = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { ascent } of entries) { const key = ascent.completed_at.slice(0, 4); counts.set(key, (counts.get(key) ?? 0) + 1) }
    return [...counts].sort(([a], [b]) => b.localeCompare(a))
  }, [entries])
  const regions = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>()
    for (const summit of summits) for (const region of regionsOf(summit)) {
      const previous = counts.get(region) ?? { total: 0, done: 0 }
      counts.set(region, { total: previous.total + 1, done: previous.done + Number(ascents.has(summit.id)) })
    }
    return [...counts].sort(([a, x], [b, y]) => y.done - x.done || a.localeCompare(b, 'ca'))
  }, [summits, ascents])
  const history = entries.filter(({ ascent }) => !year || ascent.completed_at.startsWith(year))
  const photos = history.filter(entry => entry.ascent.photo_path)

  function exportCsv() {
    const content = journalCsv(summits, visits, favorites, ['Cim', 'Comarca', 'Altitud', 'Essencial', 'Data', 'Notes', 'Preferit', 'Enllaç FEEC'].map(t), t('Sí'), t('No'))
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = '100cimscat-quadern.csv'
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="journal" id="quadern" aria-labelledby="journal-title">
    <div className="journal-heading"><div><p className="eyebrow">{t('El meu quadern')}</p><h2 id="journal-title">{t('Historial i estadístiques')}</h2></div><button type="button" className="secondary-button" disabled={!ascents.size && !favorites.size} onClick={exportCsv}><Icon name="down" />{t('Exportar CSV')}</button></div>
    <p className="field-hint">{t('El CSV inclou les ascensions, les notes i els preferits; les fotos es queden al compte.')}</p>
    <p className="journal-totals"><strong>{visits.length}</strong> {t('ascensions')} · <strong>{ascents.size}</strong> {t('cims diferents')}<span>{t('Cada cim compta una sola vegada al repte.')}</span></p>
    <div className="journal-stats">
      <details><summary>{t('Ascensions per any')}</summary>{years.length ? <ul className="year-stats">{years.map(([key, count]) => <li key={key}><span>{key}</span><meter min={0} max={Math.max(...years.map(([, n]) => n))} value={count} aria-label={`${key}: ${count}`} /><strong>{count}</strong></li>)}</ul> : <p className="field-hint">{t('Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</p>}</details>
      <details><summary>{t('Progrés per comarca')}</summary><p className="field-hint">{t('Una cima compartida compta a cada comarca.')}</p><ul className="region-stats">{regions.map(([region, counts]) => <li key={region}><span>{region}</span><meter min={0} max={counts.total} value={counts.done} aria-label={`${region}: ${counts.done} / ${counts.total}`} /><strong>{counts.done} / {counts.total}</strong></li>)}</ul></details>
    </div>
    <div className="journal-view-row"><div className="journal-tabs" role="tablist" aria-label={t('Vista del quadern')} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = view === 'history' ? 'gallery' : 'history'; setView(next); event.currentTarget.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus() } }}><button type="button" id="history-tab" role="tab" data-view="history" aria-selected={view === 'history'} tabIndex={view === 'history' ? 0 : -1} aria-controls="journal-history" onClick={() => setView('history')}><Icon name="book" />{t('Historial')}</button><button type="button" id="gallery-tab" role="tab" data-view="gallery" aria-selected={view === 'gallery'} tabIndex={view === 'gallery' ? 0 : -1} aria-controls="journal-gallery" onClick={() => setView('gallery')}><Icon name="image" />{t('Galeria')}<span>{visits.filter(visit => visit.photo_path).length}</span></button></div><label className="journal-year">{t('Any')}<select value={year} onChange={event => { setYear(event.target.value); setLimit(8); setPhotoLimit(24) }}><option value="">{t('Tots els anys')}</option>{years.map(([key]) => <option key={key}>{key}</option>)}</select></label></div>
    <div id="journal-history" role="tabpanel" aria-labelledby="history-tab" hidden={view !== 'history'}><div className="history-heading"><h3>{t('Últimes ascensions')}</h3></div>
    {history.length ? <ul className="history-list">{history.slice(0, limit).map(({ summit, ascent }) => <li key={ascentKey(ascent)}><div><strong>{summit.name}</strong><time dateTime={ascent.completed_at}>{friendlyDate(ascent.completed_at, language)}</time>{ascent.photo_path && <span className="history-photo-label">{t('Amb foto privada')}</span>}{ascent.notes && <p>{ascent.notes}</p>}</div><button type="button" className="secondary-button" aria-label={`${t('Editar ascensió')}: ${summit.name}, ${friendlyDate(ascent.completed_at, language)}`} onClick={() => onEdit(summit, ascent)}>{t('Editar ascensió')}</button></li>)}</ul> : <p className="field-hint">{t(year ? 'Encara no hi ha ascensions aquest any.' : 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</p>}
    {history.length > limit && <button type="button" className="secondary-button" onClick={() => setLimit(previous => previous + 16)}>{t('Veure més')}</button>}
    </div><div id="journal-gallery" role="tabpanel" aria-labelledby="gallery-tab" hidden={view !== 'gallery'}>{photos.length ? <><p className="field-hint">{t('Fotos de totes les visites, ordenades de més recent a més antiga. Només les pots veure tu.')}</p><div className="photo-gallery">{photos.slice(0, photoLimit).map((entry, index) => <figure key={ascentKey(entry.ascent)}><button type="button" className="photo-gallery-open" aria-label={`${t('Ampliar foto')}: ${entry.summit.name}, ${friendlyDate(entry.ascent.completed_at, language)}`} onClick={() => setSelectedPhoto(index)}><PrivatePhoto entry={entry} /><span><Icon name="image" />{t('Ampliar')}</span></button><figcaption><strong>{entry.summit.name}</strong><time dateTime={entry.ascent.completed_at}>{friendlyDate(entry.ascent.completed_at, language)}</time></figcaption></figure>)}</div>{photos.length > photoLimit && <button type="button" className="secondary-button" onClick={() => setPhotoLimit(previous => previous + 24)}>{t('Veure més fotos')}</button>}</> : <div className="empty-state"><Icon name="camera" size={34} /><h3>{t('Aquí hi viuran els teus records')}</h3><p>{t(year ? 'No hi ha fotos per a aquest any. Pots triar un altre any o afegir una foto a una visita.' : 'Afegeix una foto a qualsevol ascensió i la trobaràs aquí, també quan repeteixis un cim.')}</p><a href="#cims" className="secondary-button">{t('Explorar els cims')}</a></div>}</div>
    {selectedPhoto !== null && photos[selectedPhoto] && <PhotoViewer entries={photos} index={selectedPhoto} onIndex={setSelectedPhoto} onClose={() => setSelectedPhoto(null)} onEdit={entry => { setSelectedPhoto(null); onEdit(entry.summit, entry.ascent) }} onRefresh={entry => onRefreshPhoto(entry.ascent)} language={language} t={t} />}
  </section>
}
