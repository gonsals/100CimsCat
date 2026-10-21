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
const { filterCatalog, defaultFilters, coordinates, distanceKm, validAscentDate, localDate, journalCsv, csvCell, latestAscents, ascentKey } = moduleExports
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

test('repeated visits count a summit once and deleting one keeps the remaining ascent', () => {
  const first = { summit_id: 'canigo', completed_at: '2023-01-01', photo_path: null, notes: 'First visit' }
  const repeated = { id: 'visit-2', summit_id: 'canigo', completed_at: '2025-05-01', photo_path: 'private/photo', notes: 'Second visit' }
  const visits = [first, repeated]
  const latest = latestAscents(visits)
  assert.equal(latest.size, 1)
  assert.equal(latest.get('canigo').id, 'visit-2')
  assert.notEqual(ascentKey(first), ascentKey(repeated))
  const afterDelete = latestAscents(visits.filter(visit => ascentKey(visit) !== ascentKey(repeated)))
  assert.equal(afterDelete.size, 1)
  assert.equal(afterDelete.get('canigo').completed_at, first.completed_at)
  const sameDay = latestAscents([{ ...first, created_at: '2024-01-01T09:00:00Z' }, { ...repeated, completed_at: first.completed_at, created_at: '2024-01-01T10:00:00Z' }])
  assert.equal(sameDay.get('canigo').id, repeated.id)
  const csv = journalCsv(catalog, visits, new Set(['balandrau']), ['Name'], 'Yes', 'No')
  assert.ok(csv.includes('First visit') && csv.includes('Second visit'))
  assert.equal(csv.split('\r\n').filter(line => line.includes('Canig')).length, 2)
  assert.ok(csv.includes('Balandrau') && !csv.includes('private/photo'))
})

test('catalogue state tolerates corrupt storage and bounds restored values', () => {
  const stateModule = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/catalog-state.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports: stateModule, require: name => { assert.equal(name, '@/lib/tracker'); return moduleExports }, JSON, Number })
  const { parseCatalogState } = stateModule
  assert.equal(parseCatalogState('{broken'), null)
  assert.equal(parseCatalogState(JSON.stringify({ version: 99 })), null)
  const saved = parseCatalogState(JSON.stringify({ version: 1, search: 'Canigo', filters: { ...defaultFilters, status: 'invalid', minHeight: '-500' }, sortBy: 'distance', origin: { lat: 999, lng: 1 }, limit: 99999, scrollY: -5, view: 'map' }))
  assert.equal(saved.view, 'map')
  assert.equal(saved.filters.status, 'all')
  assert.equal(saved.filters.minHeight, '')
  assert.equal(saved.sortBy, 'name')
  assert.equal(saved.origin, null)
  assert.equal(saved.limit, 1000)
  assert.equal(saved.scrollY, 0)
})
