'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { localDate, validAscentDate, type Ascent, type Summit } from '@/lib/tracker'

type Props = { summit: Summit; ascent?: Ascent; busy: boolean; feedback: string; t: (value: string) => string; onClose: () => void; onSave: (date: string, notes: string) => Promise<void>; onDelete: () => Promise<void> }

export default function AscentEditor({ summit, ascent, busy, feedback, t, onClose, onSave, onDelete }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [date, setDate] = useState(ascent?.completed_at ?? localDate())
  const [notes, setNotes] = useState(ascent?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previous }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!validAscentDate(date)) { setError('Tria una data vàlida que no sigui futura.'); return }
    setError('')
    await onSave(date, notes.trim())
  }

  return <dialog ref={dialog} className="ascent-editor" aria-labelledby="ascent-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) { const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <button className="modal-close" type="button" aria-label={t('Tancar')} disabled={busy} onClick={onClose}>×</button>
    <p className="eyebrow">{t(ascent ? 'Editar ascensió' : 'Registrar ascensió')}</p>
    <h2 id="ascent-title">{summit.name}</h2>
    {feedback && <p className="form-error" role="status">{feedback}</p>}
    {confirmDelete ? <div className="ascent-delete-confirm"><h3>{t('Eliminar aquesta ascensió?')}</h3><p>{t('S’eliminaran la data, les notes i la foto privada d’aquest cim.')}</p><div className="editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmDelete(false)}>{t('Cancel·lar')}</button><button type="button" className="danger-button" disabled={busy} onClick={() => void onDelete()}>{t(busy ? 'Desant…' : 'Sí, eliminar ascensió')}</button></div></div>
      : <form onSubmit={submit}>
        <label htmlFor="ascent-date">{t('Data de l’ascensió')}</label><input id="ascent-date" type="date" required max={localDate()} value={date} disabled={busy} onChange={event => setDate(event.target.value)} />
        <label htmlFor="ascent-notes">{t('Notes personals')}</label><textarea id="ascent-notes" rows={5} maxLength={4000} placeholder={t('Ruta, companyia, records…')} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} />
        <div className="notes-hint"><span>{t('Les notes són privades.')}</span><span>{notes.length} / 4000</span></div>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>{t('Cancel·lar')}</button><button type="submit" className="primary-button" disabled={busy}>{t(busy ? 'Desant…' : 'Desar')}</button></div>
        {ascent && <button type="button" className="delete-ascent-trigger" disabled={busy} onClick={() => setConfirmDelete(true)}>{t('Desmarcar cim')}</button>}
      </form>}
  </dialog>
}
