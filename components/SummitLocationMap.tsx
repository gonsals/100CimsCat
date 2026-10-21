'use client'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Coordinate, Language } from '@/lib/tracker'
import Icon from '@/components/Icon'
import { trackerText } from '@/lib/tracker-i18n'

function MapControls({ language }: { language: Language }) {
  const map = useMap()
  return <div className="location-map-controls"><button type="button" aria-label={trackerText(language, 'Apropar')} onClick={() => map.zoomIn()}><Icon name="plus" /></button><button type="button" aria-label={trackerText(language, 'Allunyar')} onClick={() => map.zoomOut()}><span aria-hidden="true">−</span></button></div>
}
export default function SummitLocationMap({ point, name, language }: { point: Coordinate; name: string; language: Language }) {
  return <div className="summit-location-map" role="region" aria-label={`${trackerText(language, 'Mapa de situació')}: ${name}`}><MapContainer center={[point.lat, point.lng]} zoom={11} minZoom={6} maxZoom={16} zoomControl={false} scrollWheelZoom={false}><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' /><CircleMarker center={[point.lat, point.lng]} radius={8} pathOptions={{ color: '#fffefa', weight: 3, fillColor: '#315c45', fillOpacity: 1 }}><Popup>{name}</Popup></CircleMarker><MapControls language={language} /></MapContainer></div>
}
