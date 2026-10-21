'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import OfflineButton from '@/components/OfflineButton'
import { coordinates, localeFor, type Language, type Summit } from '@/lib/tracker'

const copy = {
  ca: { back: 'Tornar al catàleg', home: 'Inici', breadcrumbs: 'Fil d’Ariadna', challenge: 'EL REPTE DELS 100 CIMS', essential: 'Cim essencial', illustration: 'Il·lustració de referència', prepare: 'Prepara la teva visita', catalogue: 'Catàleg dels 100 Cims de la FEEC', altitude: 'Altitud', region: 'Comarca', coordinates: 'Coordenades de referència', route: 'Fitxa i recorregut FEEC', map: 'Obrir al mapa', journal: 'Veure al meu quadern', note: 'Les coordenades són orientatives. Consulta el recorregut i les condicions abans de sortir. La fitxa no substitueix un mapa topogràfic.', offline: 'Porta la fitxa a la muntanya', offlineNote: 'Desa el nom, l’altitud, la comarca i les coordenades per consultar-los sense cobertura. Els mapes, les fotos i el quadern privat requereixen connexió.', related: 'Més cims de la comarca', downloads: 'Fitxes descarregades', footer: 'Quadern de muntanya' },
  es: { back: 'Volver al catálogo', home: 'Inicio', breadcrumbs: 'Ruta de navegación', challenge: 'EL RETO DE LOS 100 CIMS', essential: 'Cima esencial', illustration: 'Ilustración de referencia', prepare: 'Prepara tu visita', catalogue: 'Catálogo de los 100 Cims de la FEEC', altitude: 'Altitud', region: 'Comarca', coordinates: 'Coordenadas de referencia', route: 'Ficha y recorrido FEEC', map: 'Abrir el mapa', journal: 'Ver en mi cuaderno', note: 'Las coordenadas son orientativas. Consulta el recorrido y las condiciones antes de salir. La ficha no sustituye un mapa topográfico.', offline: 'Lleva la ficha a la montaña', offlineNote: 'Guarda el nombre, la altitud, la comarca y las coordenadas para consultarlos sin cobertura. Los mapas, las fotos y el cuaderno privado requieren conexión.', related: 'Más cimas de la comarca', downloads: 'Fichas descargadas', footer: 'Cuaderno de montaña' },
  en: { back: 'Back to catalogue', home: 'Home', breadcrumbs: 'Breadcrumbs', challenge: 'THE 100 CIMS CHALLENGE', essential: 'Essential summit', illustration: 'Reference illustration', prepare: 'Plan your visit', catalogue: 'FEEC 100 Cims catalogue', altitude: 'Elevation', region: 'Region', coordinates: 'Reference coordinates', route: 'FEEC summit page and route', map: 'Open map', journal: 'View in my journal', note: 'Coordinates are for reference. Check the route and conditions before setting out. This page does not replace a topographic map.', offline: 'Take this summit offline', offlineNote: 'Save the name, elevation, region and coordinates to read without coverage. Maps, photos and your private journal require a connection.', related: 'More summits in this region', downloads: 'Downloaded summits', footer: 'Mountain journal' },
}

export default function SummitPageContent({ summit, related }: { summit: Summit; related: Summit[] }) {
  const [language, setLanguage] = useState<Language>('ca')
  useEffect(() => {
    try { const saved = localStorage.getItem('100cimscat-language'); if (saved === 'ca' || saved === 'es' || saved === 'en') setLanguage(saved) } catch { /* Catalan is the default. */ }
  }, [])
  const t = copy[language]
  const point = coordinates[summit.id]
  const mapUrl = point ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=14/${point.lat}/${point.lng}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${summit.name}, ${summit.region}`)}`
  const height = summit.height.toLocaleString(localeFor(language))

  return <main className="shell summit-page">
    <header className="topbar"><Link href="/" className="brand">▲ 100<span className="brand-light">CIMS</span></Link><Link href="/#cims" className="secondary-button">← {t.back}</Link></header>
    <nav className="breadcrumbs" aria-label={t.breadcrumbs}><Link href="/">{t.home}</Link><span aria-hidden="true">/</span><span>{summit.name}</span></nav>
    <article>
      <div className="summit-page-heading"><div><p className="eyebrow">{t.challenge}</p><h1>{summit.name}</h1><p className="summit-page-facts">{height} m · {summit.region}</p>{summit.essential && <span className="essential-tag">✦ {t.essential}</span>}</div><div className="summit-page-art"><MountainPlaceholder name={summit.name} height={summit.height} region={summit.region} /><span>{t.illustration}</span></div></div>
      <section className="summit-page-section" aria-labelledby="summit-information"><h2 id="summit-information">{t.prepare}</h2><p>{summit.name} · {t.catalogue}</p><p>{t.altitude}: <strong>{height} m</strong> · {t.region}: {summit.region}</p>{point && <p>{t.coordinates}: <strong>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</strong>.</p>}<div className="summit-page-actions"><a href={summit.url} target="_blank" rel="noreferrer" className="secondary-button">{t.route} ↗</a><a href={mapUrl} target="_blank" rel="noreferrer" className="secondary-button">{t.map} ↗</a><Link href={`/?cim=${summit.id}#cims`} className="primary-button" prefetch={false}>{t.journal} →</Link></div><p className="field-hint">{t.note}</p></section>
      <section className="summit-page-section" aria-labelledby="save-summit"><h2 id="save-summit">{t.offline}</h2><p>{t.offlineNote}</p><OfflineButton summit={summit} language={language} /></section>
      {related.length > 0 && <section className="summit-page-section" aria-labelledby="related-summits"><h2 id="related-summits">{t.related}</h2><ul className="related-summits">{related.map(item => <li key={item.id}><Link href={`/cims/${item.id}`} prefetch={false}>{item.name}<span>{item.height.toLocaleString(localeFor(language))} m</span></Link></li>)}</ul></section>}
    </article>
    <footer><span>100CIMS · {t.footer}</span><a href="/offline.html">{t.downloads}</a></footer>
  </main>
}
