const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const catalog = require('../data/summits.json')
function load(filename, dependencies) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name] } })
  return exports
}
const tracker = load('../lib/tracker.ts', { '@/data/summit-coordinates.json': require('../data/summit-coordinates.json') })
const { previewJournalCsv, csvRowLimit, csvByteLimit } = load('../lib/journal-import.ts', { '@/lib/tracker': tracker })
const preview = (csv, visits = [], favorites = new Set(), summits = catalog) => previewJournalCsv(csv, summits, visits, favorites)

test('CSV export round-trips accents, multiline notes, escaped quotes and formula prefixes', () => {
  const visits = [{ summit_id: 'canigo', completed_at: '2024-02-29', photo_path: 'private/photo.webp', notes: '=Ruta; "bonica"\r\nAmb amics' }]
  const csv = tracker.journalCsv(catalog, visits, new Set(['balandrau']), ['Cim','Comarca','Altitud','Essencial','Data','Notes','Preferit','Enllaç FEEC'], 'Sí', 'No')
  const rows = preview(csv)
  assert.equal(rows.length, 2)
  assert.equal(rows.find(row => row.name === 'Canigó').notes, visits[0].notes)
  assert.equal(rows.find(row => row.name === 'Canigó').status, 'ready')
  assert.equal(rows.find(row => row.name === 'Balandrau').status, 'favorite')
  assert.ok(rows.every(row => !JSON.stringify(row).includes('private/photo.webp')))
})

test('Spanish comma-separated CSV matches unaccented names and explicit day/month dates', () => {
  const rows = preview('Cima,Fecha,Notas,Favorito\ncanigo,29/02/2024,"Ruta, larga",Sí')
  assert.equal(rows[0].status, 'ready')
  assert.equal(rows[0].payload.summit_id, 'canigo')
  assert.equal(rows[0].date, '2024-02-29')
  assert.equal(rows[0].notes, 'Ruta, larga')
  assert.equal(rows[0].favorite, true)
})

test('notes from external files preserve an intentional leading apostrophe', () => {
  const rows = preview("Summit,Date,Notes\nCanigó,2024-01-01,'=My literal note")
  assert.equal(rows[0].notes, "'=My literal note")
})

test('duplicates in the journal and the file are skipped while new favorites can still be added', () => {
  const csv = 'Summit ID;Date;Notes;Favorite\ncanigo;2024-01-01;Keep;Yes\ncanigo;2024-01-01;Duplicate;Yes\ncanigo;2024-02-01;New;No'
  const rows = preview(csv, [{ summit_id: 'canigo', completed_at: '2024-01-01' }])
  assert.equal(rows[0].status, 'favorite')
  assert.equal(rows[1].status, 'duplicate')
  assert.equal(rows[2].status, 'ready')
  assert.equal(preview(csv, [], new Set(['canigo']))[1].status, 'duplicate')
})

test('unknown and ambiguous summits require an explicit match instead of guessing', () => {
  const summits = [{ ...catalog[0], id: 'one', name: 'Pic Comú', region: 'One' }, { ...catalog[1], id: 'two', name: 'Pic Comú', region: 'Two' }]
  assert.equal(preview('Summit,Date\nUnknown,2024-01-01')[0].status, 'invalid')
  assert.equal(preview('Summit,Date\nPic Comu,2024-01-01', [], new Set(), summits)[0].status, 'invalid')
  const resolved = preview('Summit,Region,Date\nPic Comu,Two,2024-01-01', [], new Set(), summits)
  assert.equal(resolved[0].payload.summit_id, 'two')
  assert.equal(preview('Summit ID,Date\nunknown,2024-01-01')[0].status, 'invalid')
})

test('invalid dates, future visits, oversized notes and invalid flags cannot be selected', () => {
  for (const [date, notes, favorite] of [['2025-02-29','','No'], ['2099-01-01','','No'], ['2024-01-01','x'.repeat(4001),'No'], ['2024-01-01','','maybe'], ['','Notes without date','Yes'], ['','','No']]) {
    const row = preview(`Summit;Date;Notes;Favorite\nCanigó;${date};${notes};${favorite}`)[0]
    assert.equal(row.status, 'invalid')
    assert.equal(row.payload, null)
  }
})

test('malformed CSV and oversized files are rejected before preview', () => {
  for (const csv of ['Summit,Date\n"Canigó,2024-01-01', 'Summit,Date\n"Canigó"bad,2024-01-01', 'Summit,Date\nCani"gó,2024-01-01', 'Summit,Date\nCanigó,2024-01-01\0']) assert.throws(() => preview(csv))
  assert.throws(() => preview('x'.repeat(csvByteLimit + 1)))
  assert.throws(() => preview('Summit,Date\n' + 'Canigó,2024-01-01\n'.repeat(csvRowLimit + 1)))
  assert.throws(() => preview('Summit,Notes\nCanigó,No date column'))
  assert.throws(() => preview('Summit,Date,Date\nCanigó,2024-01-01,2024-01-01'))
})

test('extra columns are errors, empty lines are ignored and an empty CSV is not imported', () => {
  const rows = preview('Summit,Date\r\n\r\nCanigó,2024-01-01,unexpected\r\n')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'invalid')
  assert.equal(preview('Summit,Date\n').length, 0)
})
