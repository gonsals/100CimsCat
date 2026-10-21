const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { decodeHeight, parseGrid, crossSection, render } = require('../scripts/generate-mountain-art.cjs')

test('decodes Terrarium sea level, fractional metres and negative elevations', () => {
  assert.equal(decodeHeight(128, 0, 0), 0)
  assert.equal(decodeHeight(137, 219, 68), 2523.265625)
  assert.equal(decodeHeight(127, 255, 128), -.5)
})

test('validates numeric ICGC coverage before it can become artwork', () => {
  const header = 'NCOLS 180\nNROWS 180\nXLLCORNER 250007.5\nYLLCORNER 4450002.5\nCELLSIZE 15\nNODATA_VALUE -9999\n'
  const text = header + Array(32400).fill('123.5').join(' ')
  assert.equal(parseGrid(text).values[17000], 123.5)
  assert.throws(() => parseGrid('<ServiceException>Unavailable</ServiceException>'))
  assert.throws(() => parseGrid(header + '0 1 2'))
  assert.throws(() => parseGrid(text.replace('CELLSIZE 15', 'CELLSIZE 30')))
})

test('camera projection preserves two distinct peaks and their connecting saddle', () => {
  const sample = (east, north) => Math.max(0, 800 - Math.abs(north - 300) * 2, 1000 - Math.abs(north + 300) * 2)
  const section = crossSection(sample, 90, 1000, 0, 201)
  assert.ok(Math.abs(section[70][1] - 1000) < 1e-6)
  assert.ok(Math.abs(section[130][1] - 800) < 1e-6)
  assert.equal(section[100][1], 400)
  const rotated = crossSection(sample, 0, 1000, 0, 201)
  assert.ok(rotated.every(([, height]) => height === 400))
})

test('terrain geometry follows elevations rather than a summit name seed', () => {
  const summit = { name: 'First summit', height: 1500 }
  const data = { sample: (east, north) => 1500 - Math.abs(east) * .7 - Math.abs(north) * .1 }
  const paths = svg => [...svg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1])
  const first = render(summit, data, 0, 1000).svg
  assert.deepEqual(paths(first), paths(render({ ...summit, name: 'Another name' }, data, 0, 1000).svg))
  assert.notDeepEqual(paths(first), paths(render(summit, { sample: () => 1000 }, 0, 1000).svg))
  assert.ok(!first.includes('id="snow"'))
})

test('all catalogue summits have self-contained, attributed and fingerprinted terrain artwork', () => {
  const catalog = require('../data/summits.json')
  const artwork = require('../data/mountain-art.json')
  const provenance = require('../public/mountains/provenance.json')
  assert.equal(Object.keys(artwork).length, catalog.length)
  assert.deepEqual(new Set(Object.keys(artwork)), new Set(catalog.map(summit => summit.id)))
  const files = fs.readdirSync(path.join(__dirname, '../public/mountains')).filter(name => name.endsWith('.svg'))
  assert.equal(files.length, catalog.length)
  const geometries = new Set()
  for (const summit of catalog) {
    const asset = artwork[summit.id], record = provenance.summits[summit.id]
    assert.match(asset.file, new RegExp(`^${summit.id}\\.[a-f0-9]{12}\\.svg$`))
    const svg = fs.readFileSync(path.join(__dirname, '../public/mountains', asset.file), 'utf8')
    const hash = crypto.createHash('sha256').update(svg).digest('hex').slice(0, 12)
    assert.equal(hash, record.sha256, summit.id)
    assert.ok(asset.file.includes(hash), summit.id)
    assert.equal(record.generatorVersion, provenance.version)
    assert.equal(asset.bearing, record.bearing)
    assert.ok(record.relief > 0 && record.verticalExaggeration > 0 && record.verticalExaggeration <= 2)
    assert.ok(record.sources.length && record.tiles.length)
    assert.match(svg, /viewBox="0 0 720 420"/)
    assert.ok(!/<(?:script|image|foreignObject)\b|(?:href|src)=|NaN|Infinity/.test(svg), summit.id)
    if (asset.sources.includes('icgc')) assert.match(svg, /ICGC MET, CC BY 4.0/)
    geometries.add([...svg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]).join(''))
  }
  // Nearby catalogue entries may represent two tops of the same massif.
  assert.ok(geometries.size > catalog.length * .98)
})
