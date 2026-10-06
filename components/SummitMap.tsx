'use client'

import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import summitCoordinatesJson from '@/data/summit-coordinates.json'

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
  const latStep = Math.max(0.002, (34 * 156543.03392 / 2 ** zoom) / 111320)
  const lngStep = latStep / Math.cos(42 * Math.PI / 180)
  const groups = new Map<string, SummitPoint[]>()

  for (const point of points) {
    const key = `${Math.round(point.position[0] / latStep)}:${Math.round(point.position[1] / lngStep)}`
    const group = groups.get(key) ?? []
    group.push(point)
    groups.set(key, group)
  }

  return [...groups].map(([key, group]) => ({
    key,
    points: group,
    done: group.filter(point => point.done).length,
    position: [
      group.reduce((sum, point) => sum + point.position[0], 0) / group.length,
      group.reduce((sum, point) => sum + point.position[1], 0) / group.length,
    ],
  }))
}

function MapBehavior({ points, bounds, language, onSelectSummit }: { points: SummitPoint[]; bounds: L.LatLngBounds | null; language: Language; onSelectSummit: (id: string) => void }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  useEffect(() => {
    if (!bounds || points.length === 0) return
    map.fitBounds(bounds, { padding: [26, 26], maxZoom: 8, animate: false })
  }, [bounds, map, points])

  const clusters = useMemo(() => makeClusters(points, zoom), [points, zoom])
  const labels = text[language]

  return <>
    <div className="summit-map-controls" aria-label={labels.recenter}>
      <button type="button" onClick={() => map.zoomIn()} aria-label={language === 'es' ? 'Acercar' : language === 'en' ? 'Zoom in' : 'Apropar'}>+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label={language === 'es' ? 'Alejar' : language === 'en' ? 'Zoom out' : 'Allunyar'}>−</button>
      <button type="button" onClick={() => bounds && map.fitBounds(bounds, { padding: [26, 26], maxZoom: 8 })} aria-label={labels.recenter}>⌖</button>
    </div>
    {clusters.map(cluster => {
      if (cluster.points.length === 1) {
        const point = cluster.points[0]
        return <CircleMarker
          key={point.summit.id}
          center={point.position}
          radius={point.done ? 7 : 5}
          pathOptions={{ color: point.done ? '#fffefa' : '#f7f5ee', weight: 2, fillColor: point.done ? '#456d50' : '#a69c85', fillOpacity: point.done ? 0.96 : 0.76 }}
          eventHandlers={{ click: () => map.flyTo(point.position, Math.max(map.getZoom(), 10), { duration: 0.35 }) }}
        >
          <Popup className="summit-map-popup">
            <div className="map-popup-content">
              <span className={`map-popup-state ${point.done ? 'is-done' : ''}`}>{point.done ? `✓ ${labels.done} · ${formatDate(point.completedAt, language)}` : labels.pending}</span>
              <strong>{point.summit.name}</strong>
              <span>{point.summit.height.toLocaleString(language === 'es' ? 'es-ES' : language === 'en' ? 'en-GB' : 'ca-ES')} m · {point.summit.region.replace(/\s*,\s*/g, ' · ')}</span>
              <button type="button" onClick={() => onSelectSummit(point.summit.id)}>{labels.open} ↗</button>
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
        eventHandlers={{ click: () => map.flyTo(cluster.position, Math.min(12, map.getZoom() + 2), { duration: 0.4 }) }}
      />
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
      <div className="summit-map-stage">
      <MapContainer center={[42.15, 1.7]} zoom={7} minZoom={6} maxZoom={14} zoomControl={false} scrollWheelZoom={false} attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapBehavior points={points} bounds={bounds} language={language} onSelectSummit={onSelectSummit} />
      </MapContainer>
      </div>
      <div className="summit-map-credit">
        <span>{labels.note}</span>
        <a href="https://repte100cims.joansimon.net/la-llista/" target="_blank" rel="noreferrer">{language === 'es' ? 'Coordenadas: listado de Joan Simon ↗' : language === 'en' ? 'Coordinates: Joan Simon’s list ↗' : 'Coordenades: llista de Joan Simon ↗'}</a>
      </div>
    </div>
  </div>
}
