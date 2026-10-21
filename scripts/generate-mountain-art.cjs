// Generate illustrations from real elevation tiles, once, outside the web app.
// Source/encoding: https://github.com/tilezen/joerd/blob/master/docs/formats.md
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const sharp = require('sharp')
const proj4 = require('proj4')
const { gzipSync, gunzipSync } = require('node:zlib')
const catalog = require('../data/summits.json')
const coordinates = require('../data/summit-coordinates.json')
const root = path.join(__dirname, '..')
const version = 2
const zoom = 12, world = 256 * 2 ** zoom, earth = 6378137
const cache = path.join(root, '.npm-cache/terrain-tiles')
const tiles = new Map()
const grids = new Map()
const source = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
const icgcSource = 'https://geoserveis.icgc.cat/icc_mdt/wcs/service'
const utm = '+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs'
let runningRequests = 0
const pendingRequests = []
async function request(url, options, binary = false) {
  if (runningRequests >= 6) await new Promise(resolve => pendingRequests.push(resolve))
  runningRequests++
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000), headers: { ...options?.headers, Connection: 'close' } })
        if (!response.ok) throw new Error(`Terrain source HTTP ${response.status}`)
        return binary ? Buffer.from(await response.arrayBuffer()) : await response.text()
      } catch (error) { if (attempt === 3) throw error; await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt)) }
    }
  }
  finally { runningRequests--; pendingRequests.shift()?.() }
}
const attribution = 'Terrain: Mapzen; Europe terrain produced using Copernicus data and information funded by the European Union — EU-DEM layers; SRTM/GMTED2010 courtesy of the U.S. Geological Survey.'
const views = {
  'pollego-superior-pedraforca': { bearing: 100, radius: 1250, tilt: -.18, centerWith: 'pollego-inferior-pedraforca' },
  'pollego-inferior-pedraforca': { bearing: 100, radius: 1250, tilt: -.18, centerWith: 'pollego-superior-pedraforca' },
  'sant-jeroni': { bearing: 150, radius: 1500, tilt: -.15 },
  'puigmal': { bearing: 180, radius: 3000 },
  'canigo': { bearing: 330, radius: 3300 },
  'matagalls': { bearing: 210, radius: 2400 },
  'montcau': { bearing: 210, radius: 1000 },
  'la-mola-de-sant-llorenc-del-munt': { bearing: 160, radius: 1500 },
  'les-agudes': { bearing: 100, radius: 1400 },
  'turo-de-lhome': { bearing: 190, radius: 1700 },
  'puigsacalm': { bearing: 135, radius: 1600 },
}

function parseGrid(text) {
  const tokens = text.trim().split(/\s+/), header = {}
  for (let i = 0; i < 12; i += 2) header[tokens[i].toLowerCase()] = Number(tokens[i + 1])
  const values = Float32Array.from(tokens.slice(12), Number)
  if (header.ncols !== 180 || header.nrows !== 180 || header.cellsize !== 15 || values.length !== 32400 || values.some(value => !Number.isFinite(value))) throw new Error('Invalid ICGC terrain grid')
  return { ...header, values }
}
async function icgcGrid(tx, ty) {
  const key = `icgc15-${tx}-${ty}`
  if (!grids.has(key)) grids.set(key, (async () => {
    const x = 250007.5 + tx * 2700, y = 4450002.5 + ty * 2700, file = path.join(cache, `${key}.asc.gz`)
    let text
    try { text = gunzipSync(await fs.readFile(file)).toString('utf8') }
    catch {
      const params = new URLSearchParams({ SERVICE: 'WCS', REQUEST: 'GetCoverage', VERSION: '1.0.0', CRS: 'EPSG:25831', COVERAGE: 'icc:met', WIDTH: '180', HEIGHT: '180', FORMAT: 'ArcGrid', EXCEPTIONS: 'XML', BBOX: [x, y, x + 2700, y + 2700].join(',') })
      text = await request(`${icgcSource}?${params}`); parseGrid(text)
      await fs.writeFile(file, gzipSync(text))
    }
    return parseGrid(text)
  })())
  return grids.get(key)
}
async function localTerrain(center, radius, fallback) {
  // This 15 m WCS is independent of the legacy ICGC WMS being retired in 2026.
  const project = proj4('EPSG:4326', utm)
  const [cx, cy] = project.forward([center.lng, center.lat])
  const span = radius * Math.SQRT2 * 1.04 + 50, available = new Map(), requests = []
  for (let ty = Math.floor((cy - span - 4450002.5) / 2700); ty <= Math.floor((cy + span - 4450002.5) / 2700); ty++) for (let tx = Math.floor((cx - span - 250007.5) / 2700); tx <= Math.floor((cx + span - 250007.5) / 2700); tx++) requests.push([tx, ty])
  for (let i = 0; i < requests.length; i += 4) await Promise.all(requests.slice(i, i + 4).map(async ([x, y]) => available.set(`${x}:${y}`, await icgcGrid(x, y))))
  const usedSources = new Set()
  const mLat = 111319.490793, mLng = mLat * Math.cos(center.lat * Math.PI / 180)
  function sample(east, north) {
    const [x, y] = project.forward([center.lng + east / mLng, center.lat + north / mLat])
    const col = (x - 250007.5) / 15 - .5, row = (y - 4450002.5) / 15 - .5
    const ix = Math.floor(col), iy = Math.floor(row), dx = col - ix, dy = row - iy
    const at = (i, j) => { const tx = Math.floor(i / 180), ty = Math.floor(j / 180), grid = available.get(`${tx}:${ty}`); if (!grid) throw new Error('Sample outside ICGC terrain mosaic'); return grid.values[(179 - (j - ty * 180)) * 180 + i - tx * 180] }
    const values = [at(ix, iy), at(ix + 1, iy), at(ix, iy + 1), at(ix + 1, iy + 1)]
    if (values.some(value => value === -9999)) { usedSources.add('mapzen'); return fallback.sample(east, north) }
    usedSources.add('icgc')
    return (values[0] * (1 - dx) + values[1] * dx) * (1 - dy) + (values[2] * (1 - dx) + values[3] * dx) * dy
  }
  return { ...fallback, sample, usedSources, icgcGrids: requests.map(([x, y]) => `${x}/${y}`) }
}

function pixel(point) { return { x: (point.lng + 180) / 360 * world, y: (1 - Math.asinh(Math.tan(point.lat * Math.PI / 180)) / Math.PI) / 2 * world } }
function decodeHeight(r, g, b) { return r * 256 + g + b / 256 - 32768 }
async function tile(x, y) {
  const key = `${zoom}-${x}-${y}`
  if (!tiles.has(key)) tiles.set(key, (async () => {
    const file = path.join(cache, `${key}.png`)
    let bytes
    try { bytes = await fs.readFile(file) }
    catch {
      bytes = await request(`${source}/${zoom}/${x}/${y}.png`, { headers: { 'User-Agent': '100CimsCat terrain artwork generator (https://100-cims-cat.vercel.app/contacte)' } }, true)
      await fs.writeFile(file, bytes)
    }
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== 256 || info.height !== 256 || info.channels !== 3) throw new Error(`Unexpected tile encoding: ${key}`)
    const heights = new Float32Array(256 * 256)
    for (let i = 0; i < heights.length; i++) heights[i] = decodeHeight(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])
    return heights
  })())
  return tiles.get(key)
}

async function terrain(center, radius) {
  const origin = pixel(center), metresPerPixel = Math.cos(center.lat * Math.PI / 180) * 2 * Math.PI * earth / world
  const span = radius * 2 / metresPerPixel + 2
  const available = new Map()
  const requests = []
  for (let y = Math.floor((origin.y - span) / 256); y <= Math.floor((origin.y + span) / 256); y++) for (let x = Math.floor((origin.x - span) / 256); x <= Math.floor((origin.x + span) / 256); x++) requests.push([x, y])
  // Four downloads at a time; subsequent summits reuse cached source tiles.
  for (let i = 0; i < requests.length; i += 4) await Promise.all(requests.slice(i, i + 4).map(async ([x, y]) => available.set(`${x}:${y}`, await tile(x, y))))
  function heightAtPixel(x, y) { const tx = Math.floor(x / 256), ty = Math.floor(y / 256); const data = available.get(`${tx}:${ty}`); if (!data) throw new Error('Sample outside downloaded terrain'); return data[(y - ty * 256) * 256 + x - tx * 256] }
  function sample(east, north) {
    const x = origin.x + east / metresPerPixel - .5, y = origin.y - north / metresPerPixel - .5
    const ix = Math.floor(x), iy = Math.floor(y), dx = x - ix, dy = y - iy
    return (heightAtPixel(ix, iy) * (1 - dx) + heightAtPixel(ix + 1, iy) * dx) * (1 - dy) + (heightAtPixel(ix, iy + 1) * (1 - dx) + heightAtPixel(ix + 1, iy + 1) * dx) * dy
  }
  return { sample, metresPerPixel, tileKeys: requests.map(([x, y]) => `${zoom}/${x}/${y}`) }
}

function crossSection(sample, bearing, radius, depth, count = 161) {
  const angle = bearing * Math.PI / 180
  return Array.from({ length: count }, (_, i) => {
    const across = (i / (count - 1) * 2 - 1) * radius
    const east = -Math.cos(angle) * across - Math.sin(angle) * depth
    const north = Math.sin(angle) * across - Math.cos(angle) * depth
    return [across, sample(east, north), depth]
  })
}
function chooseBearing(sample, radius) {
  const summit = sample(0, 0)
  let best = { bearing: 180, score: -Infinity }
  for (let bearing = 0; bearing < 360; bearing += 30) {
    let obstruction = 0, foreground = 0
    for (let j = 1; j <= 12; j++) {
      const a = bearing * Math.PI / 180, d = j / 12 * radius
      const height = sample(Math.sin(a) * d, Math.cos(a) * d)
      obstruction = Math.max(obstruction, height - summit + d * .05)
      foreground += summit - height
    }
    const side = crossSection(sample, bearing, radius, 0, 41)
    const relief = summit - (side[5][1] + side[35][1]) / 2
    const score = foreground / 12 + relief * .6 - obstruction * 8
    if (score > best.score) best = { bearing, score }
  }
  return best.bearing
}

function simplify(points, tolerance = .65) {
  if (points.length < 3) return points
  const [ax, ay] = points[0], [bx, by] = points.at(-1)
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy
  let farthest = 0, index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i], t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0
    const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy)
    if (distance > farthest) { farthest = distance; index = i }
  }
  return farthest > tolerance ? [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)] : [points[0], points.at(-1)]
}
const n = value => Number(value.toFixed(1))
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function mix(a, b, t) { return '#' + [0, 1, 2].map(i => Math.round(parseInt(a.slice(1 + i * 2, 3 + i * 2), 16) * (1 - t) + parseInt(b.slice(1 + i * 2, 3 + i * 2), 16) * t).toString(16).padStart(2, '0')).join('') }

function render(summit, data, bearing, radius, tilt = -.08) {
  const centerHeight = data.sample(0, 0), horizontal = 720 / (2 * radius)
  const sections = Array.from({ length: 53 }, (_, row) => crossSection(data.sample, bearing, radius, radius * (1 - row / 52 * 2)))
  const elevations = sections.flatMap(row => row.map(p => p[1]))
  const relief = Math.max(...elevations) - Math.min(...elevations)
  const vertical = Math.min(horizontal * 2, 270 / Math.max(250, relief))
  const top = Math.max(...elevations), anchor = 98 + (top - centerHeight) * vertical
  const palette = summit.height > 2200 ? { far: '#a5b5ae', front: '#354f49', sky: '#d8e3df' } : { far: '#a5b69d', front: '#365849', sky: '#dce5d8' }
  const paths = sections.map((row, index) => {
    const points = simplify(row.map(([x, height, depth]) => [360 + x * horizontal, anchor - (height - centerHeight) * vertical - depth * horizontal * tilt]))
    const d = 'M' + points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'L720 420H0Z'
    const color = mix(palette.far, palette.front, (index / 52) ** .8)
    return `<path d="${d}" fill="${color}" stroke="${color}" stroke-width=".8"/>`
  }).join('')
  const title = `${summit.name} — illustrated terrain, view from ${bearing} degrees`
  const credit = data.usedSources?.has('icgc') ? 'Terrain: ICGC MET, CC BY 4.0, transformed into an illustration. ' + attribution : attribution
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"><title>${escape(title)}</title><desc>${escape(credit)} Stylised orthographic terrain with adjusted vertical scale; not a route map. No inferred snow or trails.</desc><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${palette.sky}"/><stop offset="1" stop-color="#f1ead9"/></linearGradient><radialGradient id="glow"><stop stop-color="#efcf94" stop-opacity=".55"/><stop offset="1" stop-color="#efcf94" stop-opacity="0"/></radialGradient></defs><path fill="url(#sky)" d="M0 0h720v420H0z"/><circle cx="552" cy="95" r="145" fill="url(#glow)"/><circle cx="552" cy="95" r="29" fill="#e9cd91"/>${paths}</svg>`
  return { svg, elevation: Math.round(centerHeight), relief: Math.round(relief), verticalExaggeration: n(vertical / horizontal) }
}

async function main() {
  const args = process.argv.slice(2), idsArg = args.find(arg => arg.startsWith('--ids=')), draft = args.includes('--draft'), resume = args.includes('--resume')
  const selected = idsArg ? catalog.filter(s => idsArg.slice(6).split(',').includes(s.id)) : catalog
  if (!selected.length) throw new Error('No summits selected')
  const output = path.join(root, draft ? '.npm-cache/terrain-preview' : 'public/mountains')
  await fs.mkdir(cache, { recursive: true }); await fs.mkdir(output, { recursive: true })
  let records = {}, assets = {}
  if (idsArg || resume) { try { records = JSON.parse(await fs.readFile(path.join(output, 'provenance.json'), 'utf8')).summits } catch { /* First generation. */ } }
  if (!draft && (idsArg || resume)) { try { assets = JSON.parse(await fs.readFile(path.join(root, 'data/mountain-art.json'), 'utf8')) } catch { /* First generation. */ } }
  let saveQueue = Promise.resolve(), completed = 0
  const work = selected.filter(summit => !resume || !assets[summit.id] || records[summit.id]?.generatorVersion !== version).sort((a, b) => Number(Boolean(views[b.id])) - Number(Boolean(views[a.id])))
  async function generate(summit) {
    const config = views[summit.id] ?? {}, point = coordinates[summit.id]
    if (!point) throw new Error(`Missing summit coordinates: ${summit.id}`)
    const other = coordinates[config.centerWith]
    const center = other ? { lat: (point.lat + other.lat) / 2, lng: (point.lng + other.lng) / 2 } : point
    const radius = config.radius ?? (summit.height > 2200 ? 2600 : summit.height > 1300 ? 2100 : summit.height > 600 ? 1500 : 1000)
    const fallback = await terrain(center, radius)
    const outside = ['Andorra', 'Conflent', 'Capcir', 'Rosselló', 'Vallespir', 'Matarranya', 'Llitera']
    const international = summit.region.split(',').every(region => outside.includes(region.trim()))
    const data = international ? { ...fallback, usedSources: new Set(['mapzen']), icgcGrids: [] } : await localTerrain(center, radius, fallback)
    const bearing = config.bearing ?? chooseBearing(data.sample, radius)
    const tilt = config.tilt ?? -.08
    const art = render(summit, data, bearing, radius, tilt)
    const hash = crypto.createHash('sha256').update(art.svg).digest('hex').slice(0, 12)
    const file = `${summit.id}.${hash}.svg`
    await fs.writeFile(path.join(output, file), art.svg)
    records[summit.id] = { generatorVersion: version, bearing, radius, tilt, center, centerElevation: art.elevation, catalogElevation: summit.height, relief: art.relief, verticalExaggeration: art.verticalExaggeration, sampleSpacingM: [...data.usedSources].includes('mapzen') ? n(data.metresPerPixel) : 15, sources: [...data.usedSources].sort(), icgcGrids: data.icgcGrids, tiles: data.tileKeys, sha256: hash }
    assets[summit.id] = { file, bearing, sources: records[summit.id].sources, resolution: records[summit.id].sampleSpacingM }
    // A completed summit can be resumed after a transport interruption.
    saveQueue = saveQueue.then(async () => {
      await fs.writeFile(path.join(output, 'provenance.json'), JSON.stringify({ version, source, icgcSource, attribution, zoom, generated: new Date().toISOString().slice(0, 10), summits: records }, null, 2) + '\n')
      if (!draft) await fs.writeFile(path.join(root, 'data/mountain-art.json'), JSON.stringify(assets, null, 2) + '\n')
    })
    await saveQueue
    console.log(`${++completed}/${work.length} ${summit.id}: ${bearing}deg, ${Buffer.byteLength(art.svg)} bytes, DEM ${art.elevation}m`)
  }
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < work.length) await generate(work[next++]) }))
  await fs.writeFile(path.join(output, 'provenance.json'), JSON.stringify({ version, source, icgcSource, attribution, zoom, generated: new Date().toISOString().slice(0, 10), summits: records }, null, 2) + '\n')
  if (!idsArg && !draft) {
    const keep = new Set(Object.values(assets).map(asset => asset.file))
    for (const file of await fs.readdir(output)) if (/^[a-z0-9-]+\.[a-f0-9]{12}\.svg$/.test(file) && !keep.has(file)) {
      const target = path.resolve(output, file)
      if (path.dirname(target) !== path.resolve(output)) throw new Error('Invalid generated asset path')
      await fs.unlink(target)
    }
  }
}
module.exports = { decodeHeight, simplify, crossSection, chooseBearing, render, terrain, parseGrid, localTerrain }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
