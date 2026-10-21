'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import OfflineButton from '@/components/OfflineButton'
import SummitReference from '@/components/SummitReference'
import Icon from '@/components/Icon'
import { coordinates, friendlyDate, type Summit } from '@/lib/tracker'
import { trackerText } from '@/lib/tracker-i18n'
import { useSummitContext } from '@/lib/use-summit-context'

type Props = { summit: Summit; language: 'ca' | 'es' | 'en'; onClose: () => void; favorite: boolean; completedAt?: string; busy: boolean; onFavorite: () => void; onEdit: () => void; feedback: string }

export default function SummitDetailsModal({ summit, language, onClose, favorite, completedAt, busy, onFavorite, onEdit, feedback }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const t = (value: string) => trackerText(language, value)
  const context = useSummitContext(summit)
  const { data } = context
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previous; previousFocus?.focus() }
  }, [])
  const point = coordinates[summit.id]
  const mapUrl = point ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=14/${point.lat}/${point.lng}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${summit.name}, ${summit.region}`)}`
  const labels = language === 'es'
    ? { details: 'Ficha de la cima', essential: 'Esencial', map: 'Abrir el mapa', route: 'Ficha y recorrido FEEC', illustration: 'Ilustración de referencia', photos: 'Imagen de referencia', location: 'Consulta accesos, variantes y recorridos en la ficha FEEC. Las coordenadas son orientativas; no sustituyen un mapa de ruta.' }
    : language === 'en'
      ? { details: 'Summit details', essential: 'Essential', map: 'Open map', route: 'FEEC summit page and route', illustration: 'Reference illustration', photos: 'Reference image', location: 'See the FEEC page for access and route variants. Coordinates are for reference and do not replace route mapping.' }
      : { details: 'Fitxa del cim', essential: 'Essencial', map: 'Obrir al mapa', route: 'Fitxa i recorregut FEEC', illustration: 'Il·lustració de referència', photos: 'Imatge de referència', location: 'Consulta accessos, variants i recorreguts a la fitxa FEEC. Les coordenades són orientatives; no substitueixen un mapa de ruta.' }
  return <dialog ref={dialog} className="summit-modal" aria-labelledby="summit-modal-title" onCancel={onClose}>
    <button className="modal-close icon-button" type="button" onClick={onClose} aria-label={t('Tancar')}><Icon name="close" /></button>
    <p className="eyebrow">{labels.details}</p><h2 id="summit-modal-title">{summit.name}</h2>
    {feedback && <p className="form-error" role="status">{feedback}</p>}
    <div className="summit-facts"><strong>{summit.height.toLocaleString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'ca-ES')} m</strong><span>{summit.region.replace(/\s*,\s*/g, ' · ')}</span>{summit.essential && <span className="essential-tag"><Icon name="star" size={12} />{labels.essential}</span>}</div>
    {data?.description[language] && <p className="summit-description">{data.description[language]}</p>}
    <div className="summit-journal-actions"><button className="primary-button" type="button" disabled={busy} onClick={onEdit}><Icon name={completedAt ? 'check' : 'plus'} />{t(completedAt ? 'Editar ascensió' : 'Registrar ascensió')}{completedAt && ` · ${friendlyDate(completedAt, language)}`}</button><button className="secondary-button" type="button" disabled={busy} aria-pressed={favorite} onClick={onFavorite}><Icon name="star" style={favorite ? { fill: 'currentColor' } : undefined} />{t(favorite ? 'Treure de preferits' : 'Afegir a preferits')}</button></div>
    <div className="summit-detail-links"><Link href={`/cims/${summit.id}`} prefetch={false}>{t('Obrir fitxa completa')}<Icon name="next" size={16} /></Link><a href={summit.url} target="_blank" rel="noreferrer">{labels.route}<Icon name="arrow" size={16} /></a><a href={mapUrl} target="_blank" rel="noreferrer">{labels.map}<Icon name="arrow" size={16} /></a></div>
    <p className="summit-map-note">{labels.location}</p><OfflineButton summit={summit} language={language} />
    <h3 className="modal-photo-heading">{labels.photos}</h3><SummitReference summit={summit} language={language} context={context} />
  </dialog>
}
