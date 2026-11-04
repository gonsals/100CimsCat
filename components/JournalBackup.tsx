'use client'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FeatureDialog from '@/components/FeatureDialog'
import { downloadBlob } from '@/lib/journal-resources'
import { mountainText } from '@/lib/mountain-i18n'
import type { Language, Summit } from '@/lib/tracker'
import type { BackupPreview } from '@/lib/journal-backup'

type Props = {
  client: SupabaseClient
  userId: string
  summits: Summit[]
  language: Language
  onRefresh: () => Promise<void>
}
function BackupDialog({
  client,
  userId,
  summits,
  language,
  onRefresh,
  onClose,
}: Props & { onClose: () => void }) {
  const [busy, setBusy] = useState(false),
    [count, setCount] = useState(0),
    [status, setStatus] = useState('')
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<BackupPreview | null>(null)
  const [result, setResult] = useState<{
    created: number
    kept: number
    pending: number
  } | null>(null)
  const t = (key: Parameters<typeof mountainText>[1]) =>
    mountainText(language, key)
  async function exportZip() {
    setBusy(true)
    setCount(0)
    setStatus('')
    setResult(null)
    try {
      const { exportBackup } = await import('@/lib/journal-backup')
      const zip = await exportBackup(client, userId, setCount)
      downloadBlob(
        zip,
        `100cimscat-${new Date().toISOString().slice(0, 10)}.zip`,
      )
      setStatus('complete')
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }
  async function choose(next?: File) {
    setFile(null)
    setPreview(null)
    setResult(null)
    setStatus('')
    if (!next) return
    setBusy(true)
    setCount(0)
    try {
      const { inspectBackup } = await import('@/lib/journal-backup')
      const inspected = await inspectBackup(
        next,
        new Set(summits.map((s) => s.id)),
      )
      setFile(next)
      setPreview(inspected)
    } catch {
      setStatus('backupInvalid')
    } finally {
      setBusy(false)
    }
  }
  async function restore() {
    if (!file || !preview) return
    setBusy(true)
    setCount(0)
    setStatus('')
    setResult(null)
    try {
      const { restoreBackup } = await import('@/lib/journal-backup')
      const restored = await restoreBackup(
        client,
        userId,
        file,
        preview,
        setCount,
      )
      setResult(restored)
      setStatus(restored.pending ? 'incomplete' : 'complete')
      await onRefresh()
      window.dispatchEvent(new Event('journal-restored'))
    } catch {
      setStatus('error')
      await onRefresh().catch(() => {})
    } finally {
      setBusy(false)
    }
  }
  return (
    <FeatureDialog
      title={t('backup')}
      closeLabel={t('close')}
      busy={busy}
      onClose={onClose}
    >
      <p className="field-hint">{t('backupHelp')}</p>
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() => void exportZip()}
      >
        {t('exportZip')}
      </button>
      <hr />
      <p className="field-hint">{t('restoreHelp')}</p>
      <label className="feature-field">
        {t('backupFile')}
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => {
            void choose(e.target.files?.[0])
            e.currentTarget.value = ''
          }}
        />
      </label>
      {preview && (
        <section className="backup-preview" aria-label={t('restore')}>
          <p>
            {file?.name} ·{' '}
            {new Date(preview.manifest.created_at).toLocaleString(language)}
          </p>
          <dl>
            {(
              [
                ['visits', preview.manifest.visits.length],
                ['favorites', preview.manifest.favorites.length],
                ['photos', preview.photos],
                ['tracks', preview.tracks],
                ['lists', preview.manifest.lists.length],
                ['goals', preview.manifest.goals.length],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void restore()}
          >
            {t('restore')}
          </button>
        </section>
      )}
      {busy && (
        <p role="status">
          {t('working')} {count || ''}
        </p>
      )}
      {result && (
        <p>
          {t('created')}: {result.created} · {t('kept')}: {result.kept} ·{' '}
          {t('pending')}: {result.pending}
        </p>
      )}
      {status && <p role="status">{t(status as 'error')}</p>}
    </FeatureDialog>
  )
}
export default function JournalBackup(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setOpen(true)}
      >
        {mountainText(props.language, 'backup')}
      </button>
      {open && <BackupDialog {...props} onClose={() => setOpen(false)} />}
    </>
  )
}
