'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getOwner,
  setOwner,
  listPending,
  putPending,
  removePending,
  type PendingVisit,
} from '@/public/journal-store'
import { prepareOffline } from '@/lib/offline'
import {
  localDate,
  validAscentDate,
  type Language,
  type Summit,
} from '@/lib/tracker'
import { mountainText } from '@/lib/mountain-i18n'

export default function OfflineJournal({
  supabase,
  userId,
  summits,
  language,
  onRefresh,
}: {
  supabase: SupabaseClient
  userId: string
  summits: Summit[]
  language: Language
  onRefresh: () => Promise<void>
}) {
  const [enabled, setEnabled] = useState(false),
    [rows, setRows] = useState<PendingVisit[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [summit, setSummit] = useState(summits[0]?.id ?? ''),
    [date, setDate] = useState(localDate()),
    [notes, setNotes] = useState('')
  const active = useRef(true),
    syncing = useRef(false),
    refresh = useRef(onRefresh)
  refresh.current = onRefresh
  const t = (key: Parameters<typeof mountainText>[1]) =>
    mountainText(language, key)
  const read = useCallback(async () => {
    const owner = await getOwner()
    if (owner && owner !== userId) await setOwner(null)
    if (active.current) {
      setEnabled(owner === userId)
      setRows(await listPending(userId))
    }
  }, [userId])
  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return
    syncing.current = true
    setBusy(true)
    let changed = false,
      failed = false
    try {
      for (const row of await listPending(userId)) {
        if (!active.current) break
        const { error } = await supabase.rpc('sync_pending_visit', {
          p_id: row.id,
          p_summit: row.summit_id,
          p_date: row.completed_at,
          p_notes: row.notes,
          p_expected_user: userId,
        })
        if (error) throw error
        await removePending(row.id)
        changed = true
      }
    } catch {
      failed = true
    } finally {
      if (active.current) {
        try {
          await read()
          if (changed) await refresh.current()
        } catch {
          failed = true
        }
        if (failed) setMessage('syncError')
        else if (changed) setMessage('synced')
      }
      syncing.current = false
      if (active.current) setBusy(false)
    }
  }, [supabase, userId, read])
  useEffect(() => {
    active.current = true
    void read()
      .then(() => sync())
      .catch(() => {
        if (active.current) setMessage('storageError')
      })
    const online = () => void sync(),
      changed = () => void read().catch(() => setMessage('storageError'))
    window.addEventListener('online', online)
    window.addEventListener('pending-journal-changed', changed)
    return () => {
      active.current = false
      window.removeEventListener('online', online)
      window.removeEventListener('pending-journal-changed', changed)
    }
  }, [read, sync])
  async function enable() {
    setBusy(true)
    try {
      await prepareOffline()
      await setOwner(userId)
      await read()
    } catch {
      setMessage('storageError')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!validAscentDate(date) || notes.length > 4000) {
      setMessage('invalid')
      return
    }
    setBusy(true)
    try {
      await putPending({
        id: crypto.randomUUID(),
        owner: userId,
        summit_id: summit,
        completed_at: date,
        notes,
      })
      setNotes('')
      await read()
      setMessage('saved')
    } catch {
      setMessage('storageError')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="mountain-panel" aria-label={t('offline')}>
      <h2>{t('offline')}</h2>
      <p className="field-hint">{t('local')}</p>
      {!enabled ? (
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void enable()}
        >
          {t('enable')}
        </button>
      ) : (
        <details>
          <summary>{t('queue')}</summary>
          <div className="mountain-form">
            <label>
              {t('summit')}
              <select
                aria-label={t('summit')}
                value={summit}
                disabled={busy}
                onChange={(e) => setSummit(e.target.value)}
              >
                {summits.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('date')}
              <input
                aria-label={t('date')}
                type="date"
                value={date}
                max={localDate()}
                disabled={busy}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              {t('notes')}
              <textarea
                aria-label={t('notes')}
                maxLength={4000}
                value={notes}
                disabled={busy}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={busy || !summit}
              onClick={() => void save()}
            >
              {t('queue')}
            </button>
          </div>
          <a href="/offline.html">{t('offline')} →</a>
        </details>
      )}
      <p>
        {t('pending')}: <strong>{rows.length}</strong>
      </p>
      {rows.length > 0 && (
        <>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void sync()}
          >
            {busy ? '…' : t('sync')}
          </button>
          <ul className="pending-visits">
            {rows.map((row) => (
              <li key={row.id}>
                <span>
                  {summits.find((s) => s.id === row.summit_id)?.name} ·{' '}
                  {row.completed_at}
                </span>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void removePending(row.id)
                      .then(read)
                      .catch(() => setMessage('storageError'))
                  }
                >
                  {t('remove')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {message && <p role="status">{t(message as Parameters<typeof t>[0])}</p>}
    </section>
  )
}
