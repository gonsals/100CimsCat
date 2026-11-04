import { distanceKm } from '@/lib/tracker'
export type TrackPoint = { lat: number; lng: number; ele?: number }
export type TrackData = { segments: TrackPoint[][] }
export function validateTrack(data: unknown): TrackData {
  const value = data as TrackData
  if (
    !value ||
    !Array.isArray(value.segments) ||
    !value.segments.length ||
    value.segments.length > 1000
  )
    throw new Error('GPX_INVALID')
  let count = 0
  for (const segment of value.segments) {
    if (!Array.isArray(segment) || segment.length < 2)
      throw new Error('GPX_INVALID')
    for (const point of segment) {
      count++
      if (
        !point ||
        !Number.isFinite(point.lat) ||
        !Number.isFinite(point.lng) ||
        Math.abs(point.lat) > 90 ||
        Math.abs(point.lng) > 180 ||
        (point.ele !== undefined &&
          (!Number.isFinite(point.ele) ||
            point.ele < -500 ||
            point.ele > 10000))
      )
        throw new Error('GPX_INVALID')
    }
  }
  if (count > 10000 || JSON.stringify(value).length > 1048576)
    throw new Error('GPX_LIMIT')
  return {
    segments: value.segments.map((segment) =>
      segment.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        ...(p.ele === undefined ? {} : { ele: p.ele }),
      })),
    ),
  }
}
export function parseGpx(xml: string): TrackData {
  if (new TextEncoder().encode(xml).length > 2 * 1024 * 1024)
    throw new Error('GPX_LIMIT')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX_INVALID')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (
    doc.documentElement?.localName !== 'gpx' ||
    doc.getElementsByTagName('parsererror').length
  )
    throw new Error('GPX_INVALID')
  const segments: TrackPoint[][] = []
  const getPoints = (element: Element, tag: string) => {
    const points: TrackPoint[] = []
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== 1 || (node as Element).localName !== tag) continue
      const point = node as Element,
        lat = point.getAttribute('lat'),
        lng = point.getAttribute('lon')
      if (!lat?.trim() || !lng?.trim()) throw new Error('GPX_INVALID')
      const elevation = Array.from(point.childNodes).find(
        (n) => n.nodeType === 1 && (n as Element).localName === 'ele',
      )?.textContent
      points.push({
        lat: Number(lat),
        lng: Number(lng),
        ...(elevation?.trim() ? { ele: Number(elevation) } : {}),
      })
    }
    if (points.length >= 2) segments.push(points)
  }
  for (const node of Array.from(doc.getElementsByTagNameNS('*', 'trkseg')))
    getPoints(node, 'trkpt')
  if (!segments.length)
    for (const node of Array.from(doc.getElementsByTagNameNS('*', 'rte')))
      getPoints(node, 'rtept')
  return validateTrack({ segments })
}
export function trackStats(data: TrackData) {
  let km = 0,
    gain = 0,
    loss = 0
  const profile: { km: number; ele: number }[] = []
  for (const segment of data.segments)
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i],
        previous = segment[i - 1]
      if (previous) {
        km += distanceKm(previous, p)
        if (p.ele !== undefined && previous.ele !== undefined) {
          const delta = p.ele - previous.ele
          if (delta > 0) gain += delta
          else loss -= delta
        }
      }
      if (p.ele !== undefined) profile.push({ km, ele: p.ele })
    }
  return { km, gain, loss, profile, hasElevation: profile.length >= 2 }
}
export function toGpx(data: TrackData) {
  validateTrack(data)
  return (
    '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="100CimsCat" xmlns="http://www.topografix.com/GPX/1/1"><trk>' +
    data.segments
      .map(
        (s) =>
          '<trkseg>' +
          s
            .map(
              (p) =>
                `<trkpt lat="${p.lat}" lon="${p.lng}">${p.ele === undefined ? '' : `<ele>${p.ele}</ele>`}</trkpt>`,
            )
            .join('') +
          '</trkseg>',
      )
      .join('') +
    '</trk></gpx>'
  )
}
