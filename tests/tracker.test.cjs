const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const source = fs.readFileSync(path.join(__dirname, '../lib/tracker.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const moduleExports = {}
vm.runInNewContext(compiled, { exports: moduleExports, require: name => {
  if (name === '@/data/summit-coordinates.json') return require('../data/summit-coordinates.json')
  throw new Error(`Unexpected import: ${name}`)
}, Date, Map, Set })
const { filterCatalog, defaultFilters, coordinates, distanceKm, validAscentDate, localDate, journalCsv, csvCell } = moduleExports
const catalog = require('../data/summits.json')

test('combines pending, essential, region, height and accent-insensitive search', () => {
  const filters = { ...defaultFilters, status: 'pending', essential: true, region: 'Ripollès', minHeight: '2500', maxHeight: '2900' }
  const results = filterCatalog(catalog, new Map([['bastiments', {}]]), new Set(), filters, 'ripolles', 'name', null)
  assert.ok(results.length > 0)
  assert.ok(results.every(summit => summit.essential && summit.height >= 2500 && summit.height <= 2900 && summit.id !== 'bastiments'))
  assert.ok(filterCatalog(catalog, new Map(), new Set(), defaultFilters, 'canigo', 'name', null).some(summit => summit.name === 'Canigó'))
})

test('favorites work independently of ascent status', () => {
  const favorites = new Set(['canigo', 'balandrau'])
  const ascents = new Map([['canigo', {}]])
  const results = filterCatalog(catalog, ascents, favorites, { ...defaultFilters, status: 'pending', favorites: true }, '', 'name', null)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'balandrau')
})

test('distance ordering keeps unknown coordinates last', () => {
  const point = coordinates.canigo
  const unknown = { id: 'no-coordinates', name: 'Unknown', height: 100, region: '', essential: false, url: '' }
  const results = filterCatalog([...catalog, unknown], new Map(), new Set(), defaultFilters, '', 'distance', point)
  assert.equal(results[0].id, 'canigo')
  assert.equal(results.at(-1).id, 'no-coordinates')
  assert.equal(distanceKm(point, point), 0)
  assert.ok(Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.195) < 0.01)
})

test('rejects invalid calendar dates and future ascents', () => {
  assert.equal(validAscentDate('2025-02-29'), false)
  assert.equal(validAscentDate('2024-02-29'), true)
  assert.equal(validAscentDate('2099-01-01'), false)
  assert.equal(validAscentDate(localDate()), true)
  assert.equal(validAscentDate('garbage'), false)
})

test('CSV quotes multiline notes, preserves dates and includes pending favorites', () => {
  const selected = catalog.filter(summit => ['canigo', 'balandrau'].includes(summit.id))
  const ascents = new Map([['canigo', { completed_at: '2024-02-29', notes: 'Ruta; "bonica"\nAmb amics', photo_path: 'private/path' }]])
  const csv = journalCsv(selected, ascents, new Set(['balandrau']), ['Name', 'Region', 'Height', 'Essential', 'Date', 'Notes', 'Favorite', 'URL'], 'Yes', 'No')
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"2024-02-29"'))
  assert.ok(csv.includes('"Ruta; ""bonica""\nAmb amics"'))
  assert.ok(csv.includes('Balandrau'))
  assert.ok(!csv.includes('private/path'))
  assert.equal(csvCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"')
  assert.equal(csvCell(' @SUM(1)'), '"\' @SUM(1)"')
})
