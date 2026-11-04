'use client'

import { useMemo, useState } from 'react'
import FeatureDialog from '@/components/FeatureDialog'
import Icon from '@/components/Icon'
import {
  normalizeSearch,
  type Ascent,
  type Language,
  type Summit,
} from '@/lib/tracker'
import { journalUiText } from '@/lib/journal-ui-i18n'

type Props = {
  summits: Summit[]
  visits: Ascent[]
  language: Language
  disabled?: boolean
  onSelect: (summit: Summit) => void
}
function SummitPicker({
  summits,
  visits,
  language,
  onSelect,
  onClose,
}: Props & { onClose: () => void }) {
  const [search, setSearch] = useState('')
  const t = (key: Parameters<typeof journalUiText>[1]) =>
    journalUiText(language, key)
  const recent = useMemo(() => {
    const ids = [
      ...new Set(
        [...visits]
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
          .map((v) => v.summit_id),
      ),
    ].slice(0, 5)
    return ids.flatMap((id) => {
      const summit = summits.find((s) => s.id === id)
      return summit ? [summit] : []
    })
  }, [summits, visits])
  const query = normalizeSearch(search.trim())
  const matches = query
    ? summits
        .filter((s) => normalizeSearch(`${s.name} ${s.region}`).includes(query))
        .slice(0, 12)
    : recent.length
      ? recent
      : summits.slice(0, 12)
  return (
    <FeatureDialog
      title={t('choose')}
      closeLabel={t('close')}
      busy={false}
      onClose={onClose}
    >
      <label className="feature-field">
        {t('searchSummit')}
        <input
          type="search"
          autoFocus
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <p className="field-hint">{t('hint')}</p>
      {!query && recent.length > 0 && (
        <h3 className="picker-heading">{t('recent')}</h3>
      )}
      {matches.length ? (
        <ul className="quick-summits">
          {matches.map((summit) => (
            <li key={summit.id}>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onSelect(summit)
                }}
              >
                <span>
                  <strong>{summit.name}</strong>
                  <small>
                    {summit.region} · {summit.height.toLocaleString(language)} m
                  </small>
                </span>
                <Icon name="plus" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">{t('noMatch')}</p>
      )}
    </FeatureDialog>
  )
}
export default function QuickRecord(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="primary-button"
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" />
        {journalUiText(props.language, 'record')}
      </button>
      {open && <SummitPicker {...props} onClose={() => setOpen(false)} />}
    </>
  )
}
