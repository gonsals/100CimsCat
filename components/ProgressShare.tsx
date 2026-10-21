'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { createProgressCard, type ProgressFigures } from '@/lib/progress-card'
import type { Language } from '@/lib/tracker'

const copy = {
  ca: { heading: 'El teu camí també es pot compartir', hint: 'Tria amb quina app compartir la targeta. Les fotos i notes queden fora.', open: 'Compartir progrés', title: 'Comparteix el teu camí', preparing: 'Preparant la targeta…', share: 'Compartir imatge', copy: 'Copiar imatge', close: 'Tancar', retry: 'Tornar-ho a provar', failed: 'No s’ha pogut crear la targeta. Torna-ho a provar.', unavailable: 'Aquest navegador no permet compartir imatges directament. Pots copiar-la o mantenir-la premuda al mòbil per veure més opcions.', shareFailed: 'No s’ha pogut obrir el menú per compartir. Torna-ho a provar o mantén premuda la imatge.', copied: 'Imatge copiada. Ja la pots enganxar a una altra app.', copyFailed: 'No s’ha pogut copiar. Mantén premuda la imatge per veure més opcions.', alt: 'Targeta del meu progrés als 100 Cims', source: 'Il·lustració del relleu: ICGC · CC BY 4.0' },
  es: { heading: 'Tu camino también merece compartirse', hint: 'Elige con qué app compartir la tarjeta. Las fotos y notas quedan fuera.', open: 'Compartir progreso', title: 'Comparte tu camino', preparing: 'Preparando la tarjeta…', share: 'Compartir imagen', copy: 'Copiar imagen', close: 'Cerrar', retry: 'Volver a intentar', failed: 'No se ha podido crear la tarjeta. Vuelve a intentarlo.', unavailable: 'Este navegador no permite compartir imágenes directamente. Puedes copiarla o mantenerla pulsada en el móvil para ver más opciones.', shareFailed: 'No se ha podido abrir el menú para compartir. Vuelve a intentarlo o mantén pulsada la imagen.', copied: 'Imagen copiada. Ya puedes pegarla en otra app.', copyFailed: 'No se ha podido copiar. Mantén pulsada la imagen para ver más opciones.', alt: 'Tarjeta de mi progreso en los 100 Cims', source: 'Ilustración del relieve: ICGC · CC BY 4.0' },
  en: { heading: 'Your journey is worth sharing', hint: 'Choose an app to share your card. Photos and notes stay out.', open: 'Share progress', title: 'Share your journey', preparing: 'Preparing your card…', share: 'Share image', copy: 'Copy image', close: 'Close', retry: 'Try again', failed: 'Could not create the card. Please try again.', unavailable: 'This browser cannot share images directly. You can copy it or press and hold it on your phone for more options.', shareFailed: 'Could not open the share menu. Try again or press and hold the image.', copied: 'Image copied. You can paste it into another app.', copyFailed: 'Could not copy the image. Press and hold it for more options.', alt: 'My 100 Cims progress card', source: 'Terrain illustration: ICGC · CC BY 4.0' },
}

type Props = ProgressFigures & { language: Language; ready: boolean }

function ShareDialog({ language, essential, summits, visits, onClose }: Omit<Props, 'ready'> & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [card, setCard] = useState<{ file: File; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const t = copy[language]

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    element?.showModal(); document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [])

  useEffect(() => {
    let active = true, url = ''
    setCard(null); setFailed(false); setMessage('')
    void createProgressCard({ essential, summits, visits }, language).then(file => {
      if (!active) return
      url = URL.createObjectURL(file); setCard({ file, url })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [essential, summits, visits, language, version])

  const canShare = Boolean(card && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [card.file] }))
  const canCopy = typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

  async function share() {
    if (!card || sending || !canShare) return
    setSending(true); setMessage('')
    try {
      // The file is ready: invoke the native sheet directly in this tap's activation.
      await navigator.share({ files: [card.file], title: '100CimsCat' })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(t.shareFailed)
    } finally { setSending(false) }
  }

  async function copyImage() {
    if (!card || sending || !canCopy) return
    setSending(true); setMessage('')
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.file })]); setMessage(t.copied) }
    catch { setMessage(t.copyFailed) }
    finally { setSending(false) }
  }

  return <dialog ref={dialog} className="progress-share-dialog" aria-labelledby="progress-share-title" onCancel={event => { event.preventDefault(); if (!sending) onClose() }} onClick={event => { if (event.target === event.currentTarget && !sending) { const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <button className="modal-close icon-button" type="button" aria-label={t.close} onClick={onClose} disabled={sending}><Icon name="close" /></button>
    <h2 id="progress-share-title">{t.title}</h2><p className="field-hint">{t.hint}</p>
    {card ? <><Image className="progress-share-preview" src={card.url} width={1080} height={1350} alt={t.alt} unoptimized /><a className="progress-share-source" href="/fonts#relleu" target="_blank" rel="noreferrer">{t.source}<Icon name="arrow" size={12} /></a>{!canShare && <p className="field-hint">{t.unavailable}</p>}<div className="progress-share-actions">{canShare && <button className="primary-button" type="button" onClick={() => void share()} disabled={sending}><Icon name="share" />{t.share}</button>}{canCopy && <button className="secondary-button" type="button" onClick={() => void copyImage()} disabled={sending}>{t.copy}</button>}</div></> : failed ? <div className="progress-share-state" role="alert"><p>{t.failed}</p><button className="secondary-button" type="button" onClick={() => setVersion(value => value + 1)}>{t.retry}</button></div> : <p className="progress-share-state" role="status">{t.preparing}</p>}
    {message && <p className="field-hint" role="status">{message}</p>}
  </dialog>
}

export default function ProgressShare({ language, essential, summits, visits, ready }: Props) {
  const [open, setOpen] = useState(false)
  const t = copy[language]
  return <><div className="share-progress"><div><strong>{t.heading}</strong><span>{t.hint}</span></div><button type="button" disabled={!ready} onClick={() => setOpen(true)}><Icon name="share" size={16} />{t.open}</button></div>{open && <ShareDialog language={language} essential={essential} summits={summits} visits={visits} onClose={() => setOpen(false)} />}</>
}
