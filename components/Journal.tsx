'use client'

import { useMemo, useState } from 'react'
import { friendlyDate, journalCsv, regionsOf, type Ascent, type Language, type Summit } from '@/lib/tracker'

type Props = { summits: Summit[]; ascents: Map<string, Ascent>; favorites: Set<string>; language: Language; t: (value: string) => string; onEdit: (summit: Summit) => void }

export default function Journal({ summits, ascents, favorites, language, t, onEdit }: Props) {
  const [year, setYear] = useState('')
  const [limit, setLimit] = useState(8)
  const entries = useMemo(() => summits.flatMap(summit => {
    const ascent = ascents.get(summit.id)
    return ascent ? [{ summit, ascent }] : []
  }).sort((a, b) => b.ascent.completed_at.localeCompare(a.ascent.completed_at) || a.summit.name.localeCompare(b.summit.name)), [summits, ascents])
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

  function exportCsv() {
    const content = journalCsv(summits, ascents, favorites, ['Cim', 'Comarca', 'Altitud', 'Essencial', 'Data', 'Notes', 'Preferit', 'Enllaç FEEC'].map(t), t('Sí'), t('No'))
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = '100cimscat-quadern.csv'
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="journal" aria-labelledby="journal-title">
    <div className="journal-heading"><div><p className="eyebrow">{t('El meu quadern')}</p><h2 id="journal-title">{t('Historial i estadístiques')}</h2></div><button type="button" className="secondary-button" disabled={!ascents.size && !favorites.size} onClick={exportCsv}>↓ {t('Exportar CSV')}</button></div>
    <p className="field-hint">{t('El CSV inclou les ascensions, les notes i els preferits; les fotos es queden al compte.')}</p>
    <div className="journal-stats">
      <details><summary>{t('Ascensions per any')}</summary>{years.length ? <ul className="year-stats">{years.map(([key, count]) => <li key={key}><span>{key}</span><meter min={0} max={Math.max(...years.map(([, n]) => n))} value={count} aria-label={`${key}: ${count}`} /><strong>{count}</strong></li>)}</ul> : <p className="field-hint">{t('Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</p>}</details>
      <details><summary>{t('Progrés per comarca')}</summary><p className="field-hint">{t('Una cima compartida compta a cada comarca.')}</p><ul className="region-stats">{regions.map(([region, counts]) => <li key={region}><span>{region}</span><meter min={0} max={counts.total} value={counts.done} aria-label={`${region}: ${counts.done} / ${counts.total}`} /><strong>{counts.done} / {counts.total}</strong></li>)}</ul></details>
    </div>
    <div className="history-heading"><h3>{t('Últimes ascensions')}</h3><label>{t('Any')}<select value={year} onChange={event => { setYear(event.target.value); setLimit(8) }}><option value="">{t('Tots els anys')}</option>{years.map(([key]) => <option key={key}>{key}</option>)}</select></label></div>
    {history.length ? <ul className="history-list">{history.slice(0, limit).map(({ summit, ascent }) => <li key={summit.id}><div><strong>{summit.name}</strong><time dateTime={ascent.completed_at}>{friendlyDate(ascent.completed_at, language)}</time>{ascent.notes && <p>{ascent.notes}</p>}</div><button type="button" className="secondary-button" aria-label={`${t('Editar ascensió')}: ${summit.name}`} onClick={() => onEdit(summit)}>{t('Editar ascensió')}</button></li>)}</ul> : <p className="field-hint">{t(year ? 'Encara no hi ha ascensions aquest any.' : 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</p>}
    {history.length > limit && <button type="button" className="secondary-button" onClick={() => setLimit(previous => previous + 16)}>{t('Veure més')}</button>}
  </section>
}
