'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { localDate, validAscentDate, type Ascent, type Summit } from '@/lib/tracker'
import Icon from '@/components/Icon'

type Props = { summit: Summit; ascent?: Ascent; busy: boolean; busyLabel: string; feedback: string; t: (value: string) => string; onClose: () => void; onSave: (date: string, notes: string, file?: File) => Promise<void>; onDelete: () => Promise<void>; onNew: () => void }

export default function AscentEditor({ summit, ascent, busy, busyLabel, feedback, t, onClose, onSave, onDelete, onNew }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initial = useRef({ date: ascent?.completed_at ?? localDate(), notes: ascent?.notes ?? '' })
  const [date, setDate] = useState(initial.current.date)
  const [notes, setNotes] = useState(initial.current.notes)
  const [file, setFile] = useState<File | undefined>()
  const [preview, setPreview] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [leaveAction, setLeaveAction] = useState<'close' | 'new' | null>(null)
  const [error, setError] = useState('')
  const dirty = date !== initial.current.date || notes !== initial.current.notes || Boolean(file)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previous; previousFocus?.focus() }
  }, [])
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function leave(action: 'close' | 'new') {
    if (busy) return
    if (dirty) setLeaveAction(action)
    else if (action === 'new') onNew()
    else onClose()
  }
  function chooseFile(next?: File) {
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(next.type)) { setError('Fes servir una imatge JPEG, PNG, WebP o AVIF.'); return }
    if (next.size > 24 * 1024 * 1024) { setError('La imatge original ha de pesar menys de 24 MB per poder optimitzar-la amb seguretat.'); return }
    setFile(next); setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!validAscentDate(date)) { setError('Tria una data vàlida que no sigui futura.'); return }
    setError('')
    await onSave(date, notes.trim(), file)
  }

  return <dialog ref={dialog} className="ascent-editor" aria-labelledby="ascent-title" onCancel={event => { event.preventDefault(); leave('close') }} onClick={event => { if (event.target === event.currentTarget) { const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) leave('close') } }}>
    <button className="modal-close icon-button" type="button" aria-label={t('Tancar')} disabled={busy} onClick={() => leave('close')}><Icon name="close" /></button>
    <p className="eyebrow">{t(ascent ? 'Editar ascensió' : 'Registrar ascensió')}</p><h2 id="ascent-title">{summit.name}</h2>
    {feedback && <p className="form-error" role="status">{feedback}</p>}
    {leaveAction ? <div className="discard-confirm"><h3>{t('Descartar canvis pendents?')}</h3><p>{t('Els canvis encara no desats i la foto pendent es perdran. Les ascensions ja desades es conserven.')}</p><div className="editor-actions"><button type="button" className="secondary-button" onClick={() => setLeaveAction(null)}>{t('Continuar editant')}</button><button type="button" className="danger-button" onClick={() => { if (leaveAction === 'new') onNew(); else onClose() }}>{t('Descartar canvis')}</button></div></div>
      : confirmDelete ? <div className="ascent-delete-confirm"><h3>{t('Eliminar aquesta ascensió?')}</h3><p>{t('S’eliminarà només aquesta visita, amb les seves notes i foto. Les altres ascensions es conservaran.')}</p><div className="editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmDelete(false)}>{t('Cancel·lar')}</button><button type="button" className="danger-button" disabled={busy} onClick={() => void onDelete()}>{t(busy ? busyLabel : 'Sí, eliminar ascensió')}</button></div></div>
        : <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="ascent-date">{t('Data de l’ascensió')}</label><input id="ascent-date" type="date" required max={localDate()} value={date} disabled={busy} onChange={event => setDate(event.target.value)} />
          <label htmlFor="ascent-notes">{t('Notes personals')}</label><textarea id="ascent-notes" rows={4} maxLength={4000} placeholder={t('Ruta, companyia, records…')} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} />
          <div className="notes-hint"><span>{t('Les notes són privades.')}</span><span>{notes.length} / 4000</span></div>
          <div className="editor-photo-field"><label htmlFor="ascent-photo">{t('Foto opcional')}</label><p className="field-hint" id="photo-hint">{t('Una foto per a aquesta visita. La comprimim abans de desar-la i només la pots veure tu.')}</p>{(preview || ascent?.photoUrl) && <div className="editor-photo-preview"><Image src={preview || ascent!.photoUrl!} alt={`${t('Foto de')} ${summit.name}`} width={600} height={400} unoptimized />{file && <button type="button" className="icon-button" aria-label={t('Treure foto seleccionada')} disabled={busy} onClick={() => setFile(undefined)}><Icon name="close" /></button>}</div>}<label className="photo-dropzone" htmlFor="ascent-photo"><Icon name="camera" size={25} /><span>{file ? file.name : t(ascent?.photo_path ? 'Canviar foto' : 'Triar una foto')}</span><small>JPEG · PNG · WebP · AVIF</small><input id="ascent-photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label={t('Foto opcional')} aria-describedby="photo-hint" disabled={busy} onChange={event => { chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          {busy && <p className="save-stage" role="status"><span className="loading-dot" />{t(busyLabel)}</p>}
          <div className="editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => leave('close')}>{t('Cancel·lar')}</button><button type="submit" className="primary-button" disabled={busy}>{busy ? t(busyLabel) : <><Icon name="check" />{t('Desar')}</>}</button></div>
          {ascent && <div className="visit-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => leave('new')}><Icon name="plus" />{t('Registrar una altra ascensió')}</button><button type="button" className="delete-ascent-trigger" disabled={busy} onClick={() => setConfirmDelete(true)}><Icon name="trash" />{t('Eliminar ascensió')}</button></div>}
        </form>}
  </dialog>
}
