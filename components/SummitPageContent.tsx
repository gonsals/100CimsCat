'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import OfflineButton from '@/components/OfflineButton'
import { coordinates, localeFor, type Language, type Summit } from '@/lib/tracker'
import { usePreferences } from '@/lib/use-preferences'
import { useSummitContext } from '@/lib/use-summit-context'
import { trackerText } from '@/lib/tracker-i18n'
import { SiteHeader, SiteFooter, SkipLink } from '@/components/SiteChrome'
import Icon from '@/components/Icon'

const LocationMap = dynamic(() => import('@/components/SummitLocationMap'), { ssr: false, loading: () => <div className="map-skeleton" role="status"><span className="sr-only">Loading map</span></div> })

const copy = {
  ca: { back: 'Tornar al catàleg', home: 'Inici', breadcrumbs: 'Fil d’Ariadna', challenge: 'EL REPTE DELS 100 CIMS', essential: 'Cim essencial', illustration: 'Il·lustració de referència', prepare: 'Prepara la teva visita', catalogue: 'Catàleg dels 100 Cims de la FEEC', altitude: 'Altitud', region: 'Comarca', coordinates: 'Coordenades de referència', route: 'Fitxa i recorregut FEEC', map: 'Obrir al mapa', journal: 'Veure al meu quadern', note: 'Les coordenades són orientatives. Consulta el recorregut i les condicions abans de sortir. La fitxa no substitueix un mapa topogràfic.', offline: 'Porta la fitxa a la muntanya', offlineNote: 'Desa el nom, l’altitud, la comarca i les coordenades per consultar-los sense cobertura. Els mapes, les fotos i el quadern privat requereixen connexió.', related: 'Més cims de la comarca', downloads: 'Fitxes descarregades', footer: 'Quadern de muntanya' },
  es: { back: 'Volver al catálogo', home: 'Inicio', breadcrumbs: 'Ruta de navegación', challenge: 'EL RETO DE LOS 100 CIMS', essential: 'Cima esencial', illustration: 'Ilustración de referencia', prepare: 'Prepara tu visita', catalogue: 'Catálogo de los 100 Cims de la FEEC', altitude: 'Altitud', region: 'Comarca', coordinates: 'Coordenadas de referencia', route: 'Ficha y recorrido FEEC', map: 'Abrir el mapa', journal: 'Ver en mi cuaderno', note: 'Las coordenadas son orientativas. Consulta el recorrido y las condiciones antes de salir. La ficha no sustituye un mapa topográfico.', offline: 'Lleva la ficha a la montaña', offlineNote: 'Guarda el nombre, la altitud, la comarca y las coordenadas para consultarlos sin cobertura. Los mapas, las fotos y el cuaderno privado requieren conexión.', related: 'Más cimas de la comarca', downloads: 'Fichas descargadas', footer: 'Cuaderno de montaña' },
  en: { back: 'Back to catalogue', home: 'Home', breadcrumbs: 'Breadcrumbs', challenge: 'THE 100 CIMS CHALLENGE', essential: 'Essential summit', illustration: 'Reference illustration', prepare: 'Plan your visit', catalogue: 'FEEC 100 Cims catalogue', altitude: 'Elevation', region: 'Region', coordinates: 'Reference coordinates', route: 'FEEC summit page and route', map: 'Open map', journal: 'View in my journal', note: 'Coordinates are for reference. Check the route and conditions before setting out. This page does not replace a topographic map.', offline: 'Take this summit offline', offlineNote: 'Save the name, elevation, region and coordinates to read without coverage. Maps, photos and your private journal require a connection.', related: 'More summits in this region', downloads: 'Downloaded summits', footer: 'Mountain journal' },
}

export default function SummitPageContent({ summit, related }: { summit: Summit; related: Summit[] }) {
  const { language } = usePreferences()
  const { data, loading, error, retry } = useSummitContext(summit)
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => { setImageFailed(false) }, [summit.id])
  const t = copy[language]
  const tx = (value: string) => trackerText(language, value)
  const photo = !imageFailed ? data?.photo : null
  const point = coordinates[summit.id]
  const mapUrl = point ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=14/${point.lat}/${point.lng}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${summit.name}, ${summit.region}`)}`
  const height = summit.height.toLocaleString(localeFor(language))

  return <div className="shell summit-page"><SkipLink language={language} /><SiteHeader language={language} /><main id="main-content" tabIndex={-1}>
    <nav className="breadcrumbs" aria-label={t.breadcrumbs}><Link href="/">{t.home}</Link><span aria-hidden="true">/</span><span>{summit.name}</span></nav>
    <article>
      <div className="summit-page-heading"><div><p className="eyebrow">{t.challenge}</p><h1>{summit.name}</h1><p className="summit-page-facts">{height} m · {summit.region}</p>{summit.essential && <span className="essential-tag"><Icon name="star" size={13} />{t.essential}</span>}{data?.description[language] && <p className="summit-description">{data.description[language]} <a href={data.entityUrl} target="_blank" rel="noreferrer">Wikidata<Icon name="arrow" size={13} /></a></p>}</div><figure className="summit-reference"><div className="summit-page-art">{photo ? <Image src={photo.url} alt={summit.name} width={1280} height={853} unoptimized onError={() => setImageFailed(true)} /> : <><MountainPlaceholder name={summit.name} height={summit.height} region={summit.region} /><span>{t.illustration}</span></>}</div><figcaption>{photo ? <><span>{photo.author}</span> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> · <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons<Icon name="arrow" size={12} /></a><small>{tx('Imatge vinculada a la cima per nom i coordenades a Wikidata.')}</small></> : loading ? <span role="status">{tx('Comprovant imatges i fonts…')}</span> : (error || imageFailed) ? <span>{tx('La imatge no està disponible ara.')} <button type="button" className="text-button" onClick={() => { setImageFailed(false); retry() }}>{tx('Tornar-ho a provar')}</button></span> : tx('Il·lustració de referència; no representa una fotografia del cim.')}</figcaption></figure></div>
      <section className="summit-page-section" aria-labelledby="summit-information"><h2 id="summit-information">{t.prepare}</h2><p>{summit.name} · {t.catalogue}</p><dl className="summit-data"><div><dt>{t.altitude}</dt><dd>{height} m</dd></div><div><dt>{t.region}</dt><dd>{summit.region}</dd></div>{point && <div><dt>{t.coordinates}</dt><dd>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</dd></div>}</dl>{point && <LocationMap point={point} name={summit.name} language={language} />}<div className="summit-page-actions"><a href={summit.url} target="_blank" rel="noreferrer" className="secondary-button">{t.route}<Icon name="arrow" /></a><a href={mapUrl} target="_blank" rel="noreferrer" className="secondary-button">{t.map}<Icon name="arrow" /></a><Link href={`/?cim=${summit.id}&registrar=1#cims`} className="primary-button" prefetch={false}>{tx('Registrar ascensió')}<Icon name="plus" /></Link></div><div className="route-source"><Icon name="info" /><p>{tx('Consulta accessos, variants i recorreguts a la fitxa FEEC. L’altitud del cim no indica la dificultat ni el desnivell de la ruta.')} <a href={summit.url} target="_blank" rel="noreferrer">FEEC<Icon name="arrow" size={14} /></a></p></div><p className="field-hint">{t.note}</p></section>
      <section className="summit-page-section" aria-labelledby="save-summit"><h2 id="save-summit">{t.offline}</h2><p>{t.offlineNote}</p><OfflineButton summit={summit} language={language} /></section>
      {related.length > 0 && <section className="summit-page-section" aria-labelledby="related-summits"><h2 id="related-summits">{t.related}</h2><ul className="related-summits">{related.map(item => <li key={item.id}><Link href={`/cims/${item.id}`} prefetch={false}>{item.name}<span>{item.height.toLocaleString(localeFor(language))} m</span></Link></li>)}</ul></section>}
    </article>
    </main><SiteFooter language={language} />
  </div>
}
