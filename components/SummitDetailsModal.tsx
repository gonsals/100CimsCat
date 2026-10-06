'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type Summit = {
  id: string
  name: string
  height: number
  region: string
  essential: boolean
  url: string
}

type CommonsMetadata = { value?: string }
type CommonsImage = {
  title: string
  imageinfo?: Array<{
    thumburl?: string
    descriptionurl?: string
    extmetadata?: Record<string, CommonsMetadata>
  }>
}

type Props = {
  summit: Summit
  language: 'ca' | 'es' | 'en'
  onClose: () => void
}

const commonsCache = new Map<string, Promise<CommonsImage[]>>()

function plainText(value?: string) {
  if (!value) return ''
  return new DOMParser().parseFromString(value, 'text/html').body.textContent?.trim() ?? ''
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getCommonsImages(summitName: string) {
  const cacheKey = normalized(summitName)
  const cached = commonsCache.get(cacheKey)
  if (cached) return cached

  const request = fetch(`/api/commons?name=${encodeURIComponent(summitName)}`)
    .then(async response => {
      if (!response.ok) throw new Error('Commons is not available')
      const payload = await response.json()
      const pages = Object.values((payload.query?.pages ?? {}) as Record<string, CommonsImage>)
      const stopWords = new Set(['d', 'de', 'del', 'la', 'les', 'el', 'els', 'l', 'i', 'o'])
      const targetWords = normalized(summitName).split(' ').filter(word => word.length > 1 && !stopWords.has(word))
      const requiredWords = targetWords.length > 1 ? targetWords : normalized(summitName).split(' ').filter(Boolean)
      return pages.filter(page => {
        const fileName = normalized(page.title.replace(/^File:/i, ''))
        return requiredWords.every(word => fileName.includes(word))
      })
    })

  commonsCache.set(cacheKey, request)
  return request
}

export default function SummitDetailsModal({ summit, language, onClose }: Props) {
  const [images, setImages] = useState<CommonsImage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    setImages([])
    setLoadError(false)
    setLoading(true)
    getCommonsImages(summit.name).then(results => {
      if (active) setImages(results)
    }).catch(() => {
      if (active) setLoadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [summit.name])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const openMap = new URL('https://www.openstreetmap.org/search')
  openMap.searchParams.set('query', `${summit.name}, ${summit.region}`)
  const openCommons = new URL('https://commons.wikimedia.org/wiki/Special:MediaSearch')
  openCommons.searchParams.set('type', 'image')
  openCommons.searchParams.set('search', `${summit.name} ${summit.region}`)
  const labels = language === 'es'
    ? { details: 'Ficha de la cima', close: 'Cerrar', essential: 'Esencial', map: 'Buscar en el mapa', route: 'Ficha y recorrido FEEC', photos: 'Fotos de referencia', loading: 'Buscando imágenes con licencia libre…', empty: 'No hemos encontrado una foto con el nombre exacto.', error: 'No se han podido cargar las imágenes.', commons: 'Buscar más fotos en Wikimedia Commons', attribution: 'Cada foto conserva su autoría, licencia y enlace a la fuente. Comprueba que corresponde exactamente a esta cima antes de usarla.', location: 'La búsqueda del mapa usa el nombre y la comarca; confirma el punto exacto antes de salir.' }
    : language === 'en'
      ? { details: 'Summit details', close: 'Close', essential: 'Essential', map: 'Search the map', route: 'FEEC summit page and route', photos: 'Reference photos', loading: 'Looking for freely licensed images…', empty: 'No photo with an exact summit name was found.', error: 'Images could not be loaded.', commons: 'Find more photos on Wikimedia Commons', attribution: 'Each photo keeps its author, license and source link. Check that it shows this exact summit before using it.', location: 'The map search uses the summit and region names; confirm the exact point before setting out.' }
      : { details: 'Fitxa de la cima', close: 'Tancar', essential: 'Essencial', map: 'Cercar al mapa', route: 'Fitxa i recorregut FEEC', photos: 'Fotos de referència', loading: 'Cercant imatges amb llicència lliure…', empty: 'No hem trobat cap foto amb el nom exacte del cim.', error: 'No s’han pogut carregar les imatges.', commons: 'Cercar més fotos a Wikimedia Commons', attribution: 'Cada foto manté l’autoria, la llicència i l’enllaç a la font. Comprova que correspon exactament a aquest cim abans de fer-la servir.', location: 'La cerca del mapa fa servir el nom i la comarca; confirma el punt exacte abans de sortir.' }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="summit-modal" role="dialog" aria-modal="true" aria-labelledby="summit-modal-title">
        <button className="modal-close" onClick={onClose} aria-label={labels.close}>×</button>
        <p className="eyebrow">{labels.details}</p>
        <h2 id="summit-modal-title">{summit.name}</h2>
        <div className="summit-facts"><strong>{summit.height.toLocaleString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'ca-ES')} m</strong><span>{summit.region.replace(/\s*,\s*/g, ' · ')}</span>{summit.essential && <span className="essential-tag">✦ {labels.essential}</span>}</div>

        <div className="summit-detail-links">
          <a href={summit.url} target="_blank" rel="noreferrer">{labels.route} ↗</a>
          <a href={openMap.toString()} target="_blank" rel="noreferrer">{labels.map} ↗</a>
        </div>
        <p className="summit-map-note">{labels.location}</p>

        <div className="commons-heading"><h3>{labels.photos}</h3><a href={openCommons.toString()} target="_blank" rel="noreferrer">{labels.commons} ↗</a></div>
        {loading && <p className="commons-state">{labels.loading}</p>}
        {!loading && loadError && <p className="commons-state">{labels.error}</p>}
        {!loading && !loadError && images.length === 0 && <p className="commons-state">{labels.empty}</p>}
        {images.length > 0 && <div className="commons-grid">{images.map(image => {
          const info = image.imageinfo?.[0]
          if (!info?.thumburl || !info.descriptionurl) return null
          const author = plainText(info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value)
          const license = plainText(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value)
          return <article className="commons-image" key={image.title}>
            <a href={info.descriptionurl} target="_blank" rel="noreferrer" aria-label={`${image.title} — Wikimedia Commons`}>
              <Image src={info.thumburl} alt={image.title.replace(/^File:/i, '')} width={640} height={420} unoptimized />
            </a>
            <p>{author || image.title.replace(/^File:/i, '')}</p>
            {license && <small>{license}</small>}
          </article>
        })}</div>}
        <p className="commons-attribution">{labels.attribution}</p>
      </section>
    </div>
  )
}
