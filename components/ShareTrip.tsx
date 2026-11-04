'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FeatureDialog from '@/components/FeatureDialog'
import { mountainText } from '@/lib/mountain-i18n'
import type { TripList } from '@/lib/trip-planning'
import type { Language, Summit } from '@/lib/tracker'
function ShareDialog({
  client,
  userId,
  list,
  summits,
  language,
  onClose,
}: {
  client: SupabaseClient
  userId: string
  list: TripList
  summits: Summit[]
  language: Language
  onClose: () => void
}) {
  const [token, setToken] = useState(''),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('')
  const t = (key: Parameters<typeof mountainText>[1]) =>
    mountainText(language, key)
  useEffect(() => {
    let active = true
    void Promise.resolve(
      client
        .from('shared_trips')
        .select('token')
        .eq('source_list_id', list.id)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (active) {
          if (error) setStatus('error')
          else setToken(data?.token ?? '')
        }
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [client, list.id])
  async function publish() {
    setBusy(true)
    setStatus('')
    try {
      const { data, error } = await client.rpc('publish_trip', {
        p_list: list.id,
        p_expected_user: userId,
      })
      if (error || !data?.token) throw error
      setToken(data.token)
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }
  async function revoke() {
    setBusy(true)
    try {
      const { error } = await client
        .from('shared_trips')
        .delete()
        .eq('source_list_id', list.id)
        .eq('token', token)
      if (error) throw error
      setToken('')
      setStatus('revoked')
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }
  const url = token ? `${window.location.origin}/sortides/${token}` : ''
  return (
    <FeatureDialog
      title={t('share')}
      closeLabel={t('close')}
      busy={busy}
      onClose={onClose}
    >
      <p className="field-hint">{t('shareHelp')}</p>
      <h3>{list.name}</h3>
      <p>{list.planned_on}</p>
      <ul>
        {list.summitIds.map((id) => (
          <li key={id}>{summits.find((s) => s.id === id)?.name ?? id}</li>
        ))}
      </ul>
      <div className="feature-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void publish()}
        >
          {t('publish')}
        </button>
        {token && (
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => void revoke()}
          >
            {t('revoke')}
          </button>
        )}
      </div>
      {token && (
        <>
          <input
            className="share-url"
            aria-label={t('share')}
            readOnly
            value={url}
          />
          <button
            className="secondary-button"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setStatus('copied'))
                .catch(() => setStatus('error'))
            }
          >
            {t('copy')}
          </button>
        </>
      )}
      {status && <p role="status">{t(status as 'error')}</p>}
    </FeatureDialog>
  )
}
export default function ShareTrip(props: {
  client: SupabaseClient
  userId: string
  list: TripList
  summits: Summit[]
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
        {mountainText(props.language, 'share')}
      </button>
      {open && <ShareDialog {...props} onClose={() => setOpen(false)} />}
    </>
  )
}
