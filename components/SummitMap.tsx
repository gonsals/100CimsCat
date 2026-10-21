'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import summitCoordinatesJson from '@/data/summit-coordinates.json'
import Icon from '@/components/Icon'

type Summit = {
  id: string
  name: string
  height: number
  region: string
  essential: boolean
  url: string
}

type Language = 'ca' | 'es' | 'en'
type Coordinate = { lat: number; lng: number }
type SummitPoint = { summit: Summit; position: [number, number]; done: boolean; completedAt?: string }
type Cluster = { key: string; position: [number, number]; points: SummitPoint[]; done: number }

const summitCoordinates = summitCoordinatesJson as Record<string, Coordinate>

const text: Record<Language, { done: string; pending: string; close: string; open: string; recenter: string; note: string; unknown: string }> = {
  ca: { done: 'Fet', pending: 'Pendent', close: 'Tancar', open: 'Veure la fitxa', recenter: 'Enquadra tots els cims', note: 'Punts de referència per orientar-se; no substitueixen un mapa topogràfic ni la planificació de la ruta.', unknown: 'sense data' },
  es: { done: 'Hecho', pending: 'Pendiente', close: 'Cerrar', open: 'Ver ficha', recenter: 'Encuadrar todas las cimas', note: 'Puntos de referencia para orientarse; no sustituyen un mapa topográfico ni la planificación de la ruta.', unknown: 'sin fecha' },
  en: { done: 'Done', pending: 'To do', close: 'Close', open: 'View details', recenter: 'Show all summits', note: 'Reference points for orientation; not a replacement for a topographic map or route planning.', unknown: 'date unknown' },
}

function formatDate(value: string | undefined, language: Language) {
  if (!value) return text[language].unknown
  const locale = language === 'es' ? 'es-ES' : language === 'en' ? 'en-GB' : 'ca-ES'
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function makeClusters(points: SummitPoint[], zoom: number): Cluster[] {
  // Merge in screen space so neighboring grid cells cannot produce overlapping
  // targets. Recheck weighted centers after a merge, including at mobile widths.
  const groups: { x: number; y: number; points: SummitPoint[] }[] = []
  const gap = 56
  for (const point of points) {
    const projected = L.CRS.EPSG3857.latLngToPoint(L.latLng(point.position), zoom)
    const group = groups.find(item => Math.hypot(item.x - projected.x, item.y - projected.y) < gap)
    if (!group) groups.push({ x: projected.x, y: projected.y, points: [point] })
    else { const size = group.points.length; group.x = (group.x * size + projected.x) / (size + 1); group.y = (group.y * size + projected.y) / (size + 1); group.points.push(point) }
  }
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const first = groups[i], second = groups[j]
      if (Math.hypot(first.x - second.x, first.y - second.y) >= gap) continue
      const count = first.points.length + second.points.length
      first.x = (first.x * first.points.length + second.x * second.points.length) / count
      first.y = (first.y * first.points.length + second.y * second.points.length) / count
      first.points.push(...second.points); groups.splice(j, 1); merged = true
      break outer
    }
  }
  return groups.map(group => {
    const center = L.CRS.EPSG3857.pointToLatLng(L.point(group.x, group.y), zoom)
    return { key: group.points[0].summit.id, points: group.points, done: group.points.filter(point => point.done).length, position: [center.lat, center.lng] }
  })
}

function MapBehavior({ points, bounds, language, onSelectSummit, controlsTarget }: { points: SummitPoint[]; bounds: L.LatLngBounds | null; language: Language; onSelectSummit: (id: string) => void; controlsTarget: HTMLDivElement | null }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const previousPoints = useRef('')
  const pointIds = points.map(point => point.summit.id).sort().join('|')
  const savePosition = () => {
    const center = map.getCenter()
    try { sessionStorage.setItem('100cimscat-map-v1', JSON.stringify({ version: 1, points: pointIds, lat: center.lat, lng: center.lng, zoom: map.getZoom() })) } catch { /* Map remains usable without storage. */ }
  }
  useMapEvents({ zoomend: () => { setZoom(map.getZoom()); savePosition() }, moveend: savePosition })

  useEffect(() => {
    if (!bounds || !pointIds || previousPoints.current === pointIds) return
    previousPoints.current = pointIds
    try {
      const saved = JSON.parse(sessionStorage.getItem('100cimscat-map-v1') ?? 'null')
      if (saved?.version === 1 && saved.points === pointIds && Number.isFinite(saved.lat) && Math.abs(saved.lat) <= 90 && Number.isFinite(saved.lng) && Math.abs(saved.lng) <= 180 && Number.isFinite(saved.zoom) && saved.zoom >= 6 && saved.zoom <= 14) {
        map.setView([saved.lat, saved.lng], saved.zoom, { animate: false })
        setZoom(saved.zoom)
        return
      }
    } catch { /* Use the catalogue bounds for invalid saved positions. */ }
    map.fitBounds(bounds, { padding: [26, 26], maxZoom: 8, animate: false })
  }, [bounds, map, pointIds])

  const clusters = useMemo(() => makeClusters(points, zoom), [points, zoom])
  const labels = text[language]

  return <>
    {controlsTarget && createPortal(<div className="summit-map-controls" role="group" aria-label={labels.recenter}>
      <button type="button" onClick={() => map.zoomIn()} aria-label={language === 'es' ? 'Acercar' : language === 'en' ? 'Zoom in' : 'Apropar'}>+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label={language === 'es' ? 'Alejar' : language === 'en' ? 'Zoom out' : 'Allunyar'}>−</button>
      <button type="button" onClick={() => bounds && map.fitBounds(bounds, { padding: [26, 26], maxZoom: 8 })} aria-label={labels.recenter}><Icon name="pin" /></button>
    </div>, controlsTarget)}
    {clusters.map(cluster => {
      if (cluster.points.length === 1) {
        const point = cluster.points[0]
        return <CircleMarker
          key={point.summit.id}
          center={point.position}
          radius={point.done ? 7 : 5}
          pathOptions={{ color: point.done ? '#fffefa' : '#f7f5ee', weight: 2, fillColor: point.done ? '#456d50' : '#a69c85', fillOpacity: point.done ? 0.96 : 0.76 }}
          eventHandlers={{
            click: () => map.flyTo(point.position, Math.max(map.getZoom(), 10), { duration: 0.35 }),
            add: event => { const node = event.target.getElement(); if (node) { node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-label', `${point.summit.name}, ${point.summit.height} m`); } },
            keydown: event => { if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') { event.originalEvent.preventDefault(); onSelectSummit(point.summit.id) } },
          }}
        >
          <Popup className="summit-map-popup">
            <div className="map-popup-content">
              <span className={`map-popup-state ${point.done ? 'is-done' : ''}`}>{point.done ? `✓ ${labels.done} · ${formatDate(point.completedAt, language)}` : labels.pending}</span>
              <strong>{point.summit.name}</strong>
              <span>{point.summit.height.toLocaleString(language === 'es' ? 'es-ES' : language === 'en' ? 'en-GB' : 'ca-ES')} m · {point.summit.region.replace(/\s*,\s*/g, ' · ')}</span>
              <button type="button" onClick={() => onSelectSummit(point.summit.id)}>{labels.open} <Icon name="arrow" size={14} /></button>
            </div>
          </Popup>
        </CircleMarker>
      }

      const percentDone = cluster.done / cluster.points.length * 100
      const icon = L.divIcon({
        className: 'summit-cluster-icon',
        html: `<span class="summit-cluster-count" style="--done-share:${percentDone}%"><b>${cluster.done}</b><small>/${cluster.points.length}</small></span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      return <Marker
        key={cluster.key}
        position={cluster.position}
        icon={icon}
        title={language === 'es' ? `${cluster.done} hechas de ${cluster.points.length}` : language === 'en' ? `${cluster.done} done of ${cluster.points.length}` : `${cluster.done} fetes de ${cluster.points.length}`}
        eventHandlers={{ click: () => { if (map.getZoom() < map.getMaxZoom()) map.flyTo(cluster.position, Math.min(map.getMaxZoom(), map.getZoom() + 2), { duration: 0.4 }) } }}
      >{zoom >= map.getMaxZoom() && <Popup className="summit-map-popup"><div className="cluster-summit-list">{cluster.points.map(point => <button type="button" key={point.summit.id} onClick={() => onSelectSummit(point.summit.id)}>{point.summit.name}<Icon name="next" size={14} /></button>)}</div></Popup>}</Marker>
    })}
  </>
}

export default function SummitMap({
  summits,
  ascents,
  language,
  onSelectSummit,
}: {
  summits: Summit[]
  ascents: Map<string, { completed_at: string }>
  language: Language
  onSelectSummit: (id: string) => void
}) {
  const labels = text[language]
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null)
  const points = useMemo(() => summits.flatMap(summit => {
    const coordinate = summitCoordinates[summit.id]
    if (!coordinate) return []
    const ascent = ascents.get(summit.id)
    return [{ summit, position: [coordinate.lat, coordinate.lng] as [number, number], done: Boolean(ascent), completedAt: ascent?.completed_at }]
  }), [summits, ascents])
  const bounds = useMemo(() => points.length ? L.latLngBounds(points.map(point => point.position)) : null, [points])

  if (points.length === 0) {
    return <div className="summit-map-empty">{language === 'es' ? 'No hay cimas para mostrar con estos filtros.' : language === 'en' ? 'No summits match these filters.' : 'No hi ha cims per mostrar amb aquests filtres.'}</div>
  }

  return <div className="summit-map-wrap">
    <div className="summit-map-legend">
      <span><i className="legend-dot done" />{labels.done} <b>{points.filter(point => point.done).length}</b></span>
      <span><i className="legend-dot pending" />{labels.pending} <b>{points.filter(point => !point.done).length}</b></span>
      <span className="map-zoom-hint">{language === 'es' ? 'Acerca para descubrir cada cima' : language === 'en' ? 'Zoom in to explore each summit' : 'Apropa’t per descobrir cada cim'}</span>
    </div>
    <div className="summit-map-frame">
      <div className="summit-map-toolbar"><span>{language === 'es' ? 'Controles del mapa' : language === 'en' ? 'Map controls' : 'Controls del mapa'}</span><div ref={setControlsTarget} /></div>
      <div className="summit-map-stage">
      <MapContainer center={[42.15, 1.7]} zoom={7} minZoom={6} maxZoom={14} zoomControl={false} scrollWheelZoom={false} attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapBehavior points={points} bounds={bounds} language={language} onSelectSummit={onSelectSummit} controlsTarget={controlsTarget} />
      </MapContainer>
      </div>
      <div className="summit-map-credit">
        <span>{labels.note}</span>
        <a href="https://repte100cims.joansimon.net/la-llista/" target="_blank" rel="noreferrer">{language === 'es' ? 'Coordenadas: listado de Joan Simon ↗' : language === 'en' ? 'Coordinates: Joan Simon’s list ↗' : 'Coordenades: llista de Joan Simon ↗'}</a>
      </div>
    </div>
  </div>
}
