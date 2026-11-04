'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FeatureDialog from '@/components/FeatureDialog'
import { parseGpx, toGpx, trackStats, type TrackData } from '@/lib/gpx'
import { downloadBlob, saveTrack } from '@/lib/journal-resources'
import { ascentKey, type Ascent, type Language } from '@/lib/tracker'
import { mountainText } from '@/lib/mountain-i18n'
const GpxMap = dynamic(() => import('@/components/GpxMap'), { ssr: false })
function TrackDialog({
  client,
  userId,
  visit,
  language,
  onClose,
}: {
  client: SupabaseClient
  userId: string
  visit: Ascent
  language: Language
  onClose: () => void
}) {
  const [data, setData] = useState<TrackData | null>(null),
    [filename, setFilename] = useState('route.gpx'),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false)
  const t = (key: Parameters<typeof mountainText>[1]) =>
    mountainText(language, key)
  useEffect(() => {
    let active = true
    void Promise.resolve(
      client
        .from('visit_tracks')
        .select('data,filename')
        .eq('user_id', userId)
        .eq('visit_key', ascentKey(visit))
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (active) {
          if (error) setError('error')
          else if (data) {
            setData(data.data as TrackData)
            setFilename(data.filename)
          }
          setBusy(false)
        }
      })
      .catch(() => {
        if (active) {
          setError('error')
          setBusy(false)
        }
      })
    return () => {
      active = false
    }
  }, [client, userId, visit])
  async function choose(file?: File) {
    if (!file) return
    setError('')
    try {
      if (file.size > 2097152) throw new Error()
      setData(parseGpx(await file.text()))
      setFilename(file.name.slice(0, 120))
      setDirty(true)
    } catch {
      setError('gpxInvalid')
    }
  }
  async function save() {
    if (!data || busy) return
    setBusy(true)
    setError('')
    try {
      await saveTrack(client, userId, visit, filename, data)
      setDirty(false)
    } catch {
      setError('error')
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    try {
      const { error } = await client
        .from('visit_tracks')
        .delete()
        .eq('user_id', userId)
        .eq('visit_key', ascentKey(visit))
      if (error) throw error
      setData(null)
      setDirty(false)
      setConfirm(false)
    } catch {
      setError('error')
    } finally {
      setBusy(false)
    }
  }
  const stats = data ? trackStats(data) : null
  const min = stats?.profile.length
      ? Math.min(...stats.profile.map((p) => p.ele))
      : 0,
    max = stats?.profile.length
      ? Math.max(...stats.profile.map((p) => p.ele))
      : 0
  return (
    <FeatureDialog
      title={t('track')}
      closeLabel={t('close')}
      busy={busy}
      onClose={() => {
        if (dirty) setDiscard(true)
        else onClose()
      }}
    >
      {discard && (
        <div className="feature-actions">
          <button
            className="secondary-button"
            onClick={() => setDiscard(false)}
          >
            {t('keepEditing')}
          </button>
          <button className="danger-button" onClick={onClose}>
            {t('discard')}
          </button>
        </div>
      )}
      <p className="field-hint">{t('gpxHelp')}</p>
      <label className="feature-field">
        {t('gpxFile')}
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          disabled={busy}
          onChange={(e) => {
            void choose(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {t(error as 'error')}
        </p>
      )}
      {stats && data && (
        <>
          <p>
            {filename} · <strong>{stats.km.toFixed(2)} km</strong>
          </p>
          {stats.hasElevation ? (
            <>
              <p>
                ↑ {Math.round(stats.gain)} m · ↓ {Math.round(stats.loss)} m
              </p>
              <svg
                className="track-profile"
                viewBox="0 0 600 140"
                role="img"
                aria-label={`${t('gain')}: ${Math.round(stats.gain)} m; ${t('loss')}: ${Math.round(stats.loss)} m`}
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={stats.profile
                    .map(
                      (p, i) =>
                        `${stats.km ? (p.km / stats.km) * 590 : (i / (stats.profile.length - 1)) * 590},${130 - ((p.ele - min) / (max - min || 1)) * 120}`,
                    )
                    .join(' ')}
                />
              </svg>
            </>
          ) : (
            <p>{t('noElevation')}</p>
          )}
          <p className="field-hint">{t('routeEstimate')}</p>
          <GpxMap data={data} />
          <div className="feature-actions">
            <button
              className="primary-button"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              {t('save')}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                downloadBlob(
                  new Blob([toGpx(data)], { type: 'application/gpx+xml' }),
                  `${visit.summit_id}.gpx`,
                )
              }
            >
              {t('download')}
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              {t('remove')}
            </button>
          </div>
          {confirm && (
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              {t('confirmRemove')}
            </button>
          )}
        </>
      )}
    </FeatureDialog>
  )
}
export default function VisitTrack(props: {
  client: SupabaseClient
  userId: string
  visit: Ascent
  language: Language
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setOpen(true)}
      >
        {mountainText(props.language, 'track')}
      </button>
      {open && <TrackDialog {...props} onClose={() => setOpen(false)} />}
    </>
  )
}
