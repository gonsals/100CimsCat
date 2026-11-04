'use client'
import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { TrackData } from '@/lib/gpx'
function Bounds({ data }: { data: TrackData }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(
      L.latLngBounds(
        data.segments.flatMap((s) =>
          s.map((p) => [p.lat, p.lng] as [number, number]),
        ),
      ),
      { padding: [20, 20], maxZoom: 15 },
    )
  }, [data, map])
  return null
}
export default function GpxMap({ data }: { data: TrackData }) {
  const bounds = useMemo(
    () =>
      L.latLngBounds(
        data.segments.flatMap((s) =>
          s.map((p) => [p.lat, p.lng] as [number, number]),
        ),
      ),
    [data],
  )
  return (
    <div className="gpx-map">
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {data.segments.map((s, i) => (
          <Polyline
            key={i}
            positions={s.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#315c45', weight: 4 }}
          />
        ))}
        <Bounds data={data} />
      </MapContainer>
    </div>
  )
}
