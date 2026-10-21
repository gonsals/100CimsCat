'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { friendlyDate, type Ascent, type Summit } from '@/lib/tracker'

export type PhotoEntry = { summit: Summit; ascent: Ascent }
export function PrivatePhoto({ entry, large = false }: { entry: PhotoEntry; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [entry.ascent.photoUrl])
  if (!entry.ascent.photoUrl || failed) return <div className="private-photo-unavailable"><Icon name="image" size={32} /><span>{entry.summit.name}</span></div>
  return <Image src={entry.ascent.photoUrl} alt={entry.summit.name} width={large ? 1440 : 600} height={large ? 1080 : 450} sizes={large ? '95vw' : '(max-width: 560px) 50vw, 33vw'} unoptimized loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
}

export default function PhotoViewer({ entries, index, onIndex, onClose, onEdit, onRefresh, language, t }: { entries: PhotoEntry[]; index: number; onIndex: (index: number) => void; onClose: () => void; onEdit: (entry: PhotoEntry) => void; onRefresh: (entry: PhotoEntry) => Promise<void>; language: 'ca' | 'es' | 'en'; t: (value: string) => string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const current = entries[index]
  useEffect(() => {
    const element = dialog.current
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    element?.showModal(); document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previousOverflow; previous?.focus() }
  }, [])
  useEffect(() => { setRefreshFailed(false) }, [index])
  async function refresh() {
    if (!current || refreshing) return
    setRefreshing(true); setRefreshFailed(false)
    try { await onRefresh(current) } catch { setRefreshFailed(true) }
    finally { setRefreshing(false) }
  }
  if (!current) return null
  return <dialog ref={dialog} className="photo-viewer" aria-labelledby="photo-viewer-title" onCancel={onClose} onKeyDown={event => {
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); onIndex(index - 1) }
    if (event.key === 'ArrowRight' && index < entries.length - 1) { event.preventDefault(); onIndex(index + 1) }
  }}><header><div><p className="eyebrow">{t('Records privats')}</p><h2 id="photo-viewer-title">{current.summit.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={t('Tancar')}><Icon name="close" /></button></header><div className="photo-viewer-image"><PrivatePhoto entry={current} large /></div><div className="photo-viewer-navigation"><button type="button" className="icon-button" disabled={index === 0} aria-label={t('Foto anterior')} onClick={() => onIndex(index - 1)}><Icon name="back" /></button><p aria-live="polite"><time dateTime={current.ascent.completed_at}>{friendlyDate(current.ascent.completed_at, language)}</time><span>{index + 1} / {entries.length}</span></p><button type="button" className="icon-button" disabled={index === entries.length - 1} aria-label={t('Foto següent')} onClick={() => onIndex(index + 1)}><Icon name="next" /></button></div>{current.ascent.notes && <p className="photo-viewer-notes">{current.ascent.notes}</p>}<div className="photo-viewer-actions"><button type="button" className="secondary-button" onClick={() => onEdit(current)}>{t('Editar ascensió')}</button><button type="button" className="text-button" disabled={refreshing} onClick={() => void refresh()}>{t(refreshing ? 'Carregant foto…' : 'Actualitzar foto')}</button></div>{refreshFailed && <p className="form-error" role="alert">{t('No hem pogut carregar la foto. Comprova la connexió i torna-ho a provar.')}</p>}</dialog>
}
