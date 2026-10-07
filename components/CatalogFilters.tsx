'use client'

import { useMemo, useState } from 'react'
import { coordinates, regionsOf, type CatalogFilter, type Coordinate, type Summit } from '@/lib/tracker'

type Props = {
  summits: Summit[]; filters: CatalogFilter; onChange: (filters: CatalogFilter) => void
  search: string; onSearch: (value: string) => void; t: (value: string) => string
  origin: Coordinate | null; originLabel: string; onOrigin: (point: Coordinate | null, label: string) => void
  onNotice: (message: string) => void
}

export default function CatalogFilters({ summits, filters, onChange, search, onSearch, t, origin, originLabel, onOrigin, onNotice }: Props) {
  const [locating, setLocating] = useState(false)
  const regions = useMemo(() => [...new Set(summits.flatMap(regionsOf))].sort((a, b) => a.localeCompare(b, 'ca')), [summits])
  const referenceSummits = useMemo(() => summits.filter(summit => coordinates[summit.id]), [summits])
  const advancedCount = Number(Boolean(filters.region)) + Number(Boolean(filters.minHeight)) + Number(Boolean(filters.maxHeight))
  const invalidRange = Boolean(filters.minHeight && filters.maxHeight && Number(filters.minHeight) > Number(filters.maxHeight))

  function locate() {
    if (!navigator.geolocation) { onNotice(t('Aquest navegador no permet la geolocalització.')); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false)
      onOrigin({ lat: position.coords.latitude, lng: position.coords.longitude }, 'La teva ubicació')
    }, () => {
      setLocating(false)
      onNotice(t('No s’ha pogut obtenir la ubicació. Pots triar un cim de referència.'))
    }, { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false })
  }

  return <div className="catalog-filters">
    <label className="search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={t('Cerca un cim o una comarca...')} aria-label={t('Cerca per cim o comarca')} /></label>
    <div className="filters" role="group" aria-label={t('Filtrar cims')}>
      {([['all', 'Tots'], ['pending', 'Pendents'], ['done', 'Fets']] as const).map(([value, label]) => <button key={value} type="button" className={`filter ${filters.status === value ? 'active' : ''}`} aria-pressed={filters.status === value} onClick={() => onChange({ ...filters, status: value })}>{t(label)}</button>)}
      <button type="button" className={`filter essential-filter ${filters.essential ? 'active' : ''}`} aria-pressed={filters.essential} onClick={() => onChange({ ...filters, essential: !filters.essential })}>{t('✦ Essencials')}</button>
      <button type="button" className={`filter ${filters.favorites ? 'active' : ''}`} aria-pressed={filters.favorites} onClick={() => onChange({ ...filters, favorites: !filters.favorites })}>☆ {t('Preferits')}</button>
    </div>
    <details className="advanced-filters">
      <summary>{t('Més filtres')}{advancedCount > 0 && <span className="filter-count">{advancedCount}</span>}</summary>
      <div className="filter-fields">
        <label>{t('Comarca')}<select aria-label={t('Comarca')} value={filters.region} onChange={event => onChange({ ...filters, region: event.target.value })}><option value="">{t('Totes les comarques')}</option>{regions.map(region => <option key={region}>{region}</option>)}</select></label>
        <label>{t('Altitud mínima (m)')}<input type="number" inputMode="numeric" min="0" max="9000" step="1" placeholder="0" value={filters.minHeight} onChange={event => onChange({ ...filters, minHeight: event.target.value })} aria-invalid={invalidRange} /></label>
        <label>{t('Altitud màxima (m)')}<input type="number" inputMode="numeric" min="0" max="9000" step="1" placeholder="4000" value={filters.maxHeight} onChange={event => onChange({ ...filters, maxHeight: event.target.value })} aria-invalid={invalidRange} /></label>
      </div>
      {invalidRange && <p className="form-error" role="alert">{t('La mínima no pot superar la màxima.')}</p>}
    </details>
    <details className="nearby-filters">
      <summary>⌖ {t('Cims propers')}{origin && <span className="origin-label"> · {t(originLabel)}</span>}</summary>
      <div className="nearby-fields"><button type="button" className="secondary-button" disabled={locating} onClick={locate}>{locating ? t('Localitzant…') : t('Fer servir la meva ubicació')}</button><label>{t('O tria un cim de referència')}<select value={referenceSummits.find(summit => summit.name === originLabel)?.id ?? ''} onChange={event => {
        const summit = summits.find(item => item.id === event.target.value)
        onOrigin(summit ? coordinates[summit.id] : null, summit?.name ?? '')
      }}><option value="">{t('Tria un punt')}</option>{referenceSummits.map(summit => <option key={summit.id} value={summit.id}>{summit.name}</option>)}</select></label></div>
      <p className="field-hint">{t('Distància en línia recta; no és la distància de la ruta.')}</p>
    </details>
  </div>
}
