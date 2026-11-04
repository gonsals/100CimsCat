const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DOMParser } = require('@xmldom/xmldom')
const { zipSync, strToU8 } = require('fflate')
const { createClient } = require('@supabase/supabase-js')
const cache = {}
function load(name) {
  if (cache[name]) return cache[name]
  const filename = path.join(__dirname, '..', name.replace('@/', '') + '.ts')
  const exports = cache[name] = {}
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: dependency => dependency.endsWith('.json') ? require('../' + dependency.replace('@/', '')) : dependency.startsWith('@/') ? load(dependency) : require(dependency), DOMParser, TextEncoder, Blob, Uint8Array, crypto, Date, Set, Map, URL })
  return exports
}
const { parseGpx, toGpx, trackStats, validateTrack } = load('@/lib/gpx')
const { annualProgress, calendarDays } = load('@/lib/journal-metrics')
const { inspectBackup, exportBackup, restoreBackup, validateManifest } = load('@/lib/journal-backup')
const owner = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const track = { segments: [[{ lat: 42, lng: 2, ele: 100 }, { lat: 42.01, lng: 2.01, ele: 130 }], [{ lat: 44, lng: 3, ele: 200 }, { lat: 44.01, lng: 3.01, ele: 180 }]] }
const gpx = toGpx(track)
const visits = [{ summit_id: 'canigo', completed_at: '2024-02-29', notes: 'Ruta; "bonica"\nAmb amics', photo_path: `${owner}/canigo/photo.png` }]
const summits = new Set(['canigo', 'balandrau'])
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
const manifest = () => ({ format: '100cimscat-backup', version: 1, backup_id: id, created_at: '2024-03-01T12:00:00Z', visits: [{ source_key: 'first:canigo', summit_id: 'canigo', completed_at: '2024-02-29', notes: visits[0].notes }], favorites: ['canigo'], lists: [{ id, name: 'Next trip', notes: 'Private plan', planned_on: '2027-05-01', summitIds: ['canigo', 'balandrau'] }], goals: [{ year: 2024, metric: 'unique', target: 20 }] })
const archive = (m, files = {}, options) => new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify(m)), ...files }, options)])
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const clientFor = read => createClient('https://fixture.supabase.test', 'test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => read(new URL(input), options) } })

test('offline catalogue matches the app catalogue', () => {
  assert.deepEqual(require('../public/summits-catalog.json'), require('../data/summits.json'))
})

test('GPX round-trip keeps segments and elevation without bridging gaps', () => {
  const parsed = parseGpx(gpx), stats = trackStats(parsed)
  assert.equal(parsed.segments.length, 2)
  assert.ok(stats.km > 2 && stats.km < 4)
  assert.equal(stats.gain, 30); assert.equal(stats.loss, 20)
  assert.equal(JSON.stringify(parsed), JSON.stringify(track))
})
test('GPX supports namespaces and route points without elevation', () => {
  const data = parseGpx('<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1"><g:rte><g:rtept lat="42" lon="2"/><g:rtept lat="42.01" lon="2.01"/></g:rte></g:gpx>')
  assert.equal(trackStats(data).hasElevation, false)
})
test('GPX rejects entity declarations, malformed XML, bad coordinates and limits', () => {
  for (const xml of ['<!DOCTYPE gpx [<!ENTITY x "boom">]><gpx/>', '<gpx><trk>', '<gpx><rte><rtept lat="" lon="2"/><rtept lat="42" lon="2"/></rte></gpx>', '<gpx/>', 'x'.repeat(2097153)]) assert.throws(() => parseGpx(xml))
  for (const point of [{ lat: 91, lng: 2 }, { lat: 42, lng: Infinity }, { lat: 42, lng: 2, ele: 10001 }]) assert.throws(() => validateTrack({ segments: [[point, point]] }))
  assert.throws(() => validateTrack({ segments: [Array.from({ length: 10001 }, () => ({ lat: 42, lng: 2 }))] }))
})
test('annual goals distinguish visits, unique summits and essential summits', () => {
  const rows = [visits[0], { ...visits[0] }, { ...visits[0], summit_id: 'balandrau' }, { ...visits[0], completed_at: '2023-01-01' }]
  const catalog = [{ id: 'canigo', essential: true }, { id: 'balandrau', essential: false }]
  assert.equal(annualProgress(rows, catalog, { year: 2024, target: 2, metric: 'visits' }).percent, 100)
  assert.equal(annualProgress(rows, catalog, { year: 2024, target: 3, metric: 'unique' }).count, 2)
  assert.equal(annualProgress(rows, catalog, { year: 2024, target: 2, metric: 'essential' }).count, 1)
})
test('calendar uses Monday alignment, leap days and preserves repeated visits', () => {
  const days = calendarDays('2024-02', [visits[0], visits[0]])
  assert.equal(days.offset, 3); assert.equal(days.days.length, 29); assert.equal(days.days[28].visits.length, 2)
  assert.throws(() => calendarDays('2024-13', []))
})
test('backup preview validates metadata before any restore operation', async () => {
  const preview = await inspectBackup(archive(manifest()), summits)
  assert.equal(preview.manifest.visits[0].notes, visits[0].notes)
  assert.equal(preview.manifest.lists[0].planned_on, '2027-05-01')
  for (const change of [m => m.version = 2, m => m.visits[0].summit_id = 'unknown', m => m.visits[0].completed_at = '2025-02-29', m => m.visits[0].notes = 'x'.repeat(4001), m => m.visits.push(m.visits[0]), m => m.goals[0].target = 0, m => m.lists[0].summitIds.push('canigo')]) {
    const m = manifest(); change(m); assert.throws(() => validateManifest(m, summits))
  }
})
test('ZIP rejects traversal, duplicate entries, huge expansion and missing attachments', async () => {
  await assert.rejects(inspectBackup(archive(manifest(), { '../private.txt': strToU8('bad') }), summits))
  await assert.rejects(inspectBackup(archive(manifest(), { 'photos/0.png': new Uint8Array(524289) }), summits))
  const m = manifest(); m.visits[0].track = { entry: 'tracks/0.gpx', filename: 'route.gpx' }
  await assert.rejects(inspectBackup(archive(m), summits))
  // Two central-directory entries with different names are changed to collide.
  const duplicate = zipSync({ 'tracks/0.gpx': strToU8(gpx), 'tracks/1.gpx': strToU8(gpx), 'manifest.json': strToU8(JSON.stringify(manifest())) })
  const renamed = Buffer.from(duplicate).toString('latin1').replaceAll('tracks/1.gpx', 'tracks/0.gpx')
  await assert.rejects(inspectBackup(new Blob([Buffer.from(renamed, 'latin1')]), summits))
})
test('full ZIP export round-trips private photos, notes, lists, goals and GPX', async () => {
  const client = clientFor((url, options) => {
    const table = url.pathname.split('/').pop()
    if (table === 'ascent_records') return json(visits)
    if (table === 'ascent_visits') return json([])
    if (table === 'summit_favorites') return json([{ summit_id: 'canigo' }])
    if (table === 'trip_lists') return json([{ ...manifest().lists[0], trip_list_summits: [{ summit_id: 'canigo', position: 0 }, { summit_id: 'balandrau', position: 1 }] }])
    if (table === 'visit_tracks') return json([{ visit_key: 'first:canigo', summit_id: 'canigo', filename: 'route.gpx', data: track }])
    if (table === 'journal_goals') return json(manifest().goals)
    if (url.pathname.includes('/object/sign/')) return json([{ path: visits[0].photo_path, signedURL: '/private?token=secret' }])
    if (url.pathname.includes('/object/')) return new Response(png, { headers: { 'content-type': 'image/png' } })
    throw Error(url.pathname)
  })
  const file = await exportBackup(client, owner, () => {})
  const preview = await inspectBackup(file, summits)
  assert.equal(preview.photos, 1); assert.equal(preview.tracks, 1)
  assert.equal(preview.manifest.visits[0].notes, visits[0].notes)
  const metadata = JSON.stringify(preview.manifest)
  assert.ok(!metadata.includes(owner) && !metadata.includes('photo_path') && !metadata.includes('secret'))
  const changed = structuredClone(preview.manifest); changed.visits[0].photo.sha256 = '0'.repeat(64)
  await assert.rejects(inspectBackup(archive(changed, { 'photos/0.png': png, 'tracks/0.gpx': strToU8(gpx) }), summits))
})
test('restore binds metadata to owner, derives stable list IDs and preserves existing photos and routes', async () => {
  const m = manifest(); m.visits[0].track = { entry: 'tracks/0.gpx', filename: 'route.gpx' }
  const file = archive(m, { 'tracks/0.gpx': strToU8(gpx) }), preview = await inspectBackup(file, summits), extras = []
  let created = true, writes = 0
  const client = clientFor((url, options) => {
    if (url.pathname.endsWith('/restore_backup_visits')) {
      const body = JSON.parse(options.body); assert.equal(body.p_expected_user, owner); assert.equal(body.p_backup, id)
      const result = [{ source_key: 'first:canigo', visit: visits[0], created }]; created = false; return json(result)
    }
    if (url.pathname.endsWith('/restore_backup_extras')) { extras.push(JSON.parse(options.body)); return json(null) }
    if (url.pathname.endsWith('/visit_tracks')) { if (options.method !== 'GET') writes++; return json([{ visit_key: 'first:canigo' }]) }
    throw Error('Existing attachment should not be written: ' + url.pathname)
  })
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).created, 1)
  const result = await restoreBackup(client, owner, file, preview, () => {})
  assert.equal(result.kept, 1); assert.equal(result.pending, 0); assert.equal(writes, 0)
  assert.equal(extras[0].p_lists[0].id, extras[1].p_lists[0].id)
  assert.notEqual(extras[0].p_lists[0].id, id); assert.equal(extras[0].p_lists[0].source_id, id)
})
test('restore reports failed attachments and succeeds on retry with same metadata identity', async () => {
  const m = manifest(); m.visits[0].track = { entry: 'tracks/0.gpx', filename: 'route.gpx' }
  const file = archive(m, { 'tracks/0.gpx': strToU8(gpx) }), preview = await inspectBackup(file, summits)
  let failed = true, attempts = 0
  const client = clientFor((url, options) => {
    if (url.pathname.endsWith('/restore_backup_visits')) return json([{ source_key: 'first:canigo', visit: visits[0], created: false }])
    if (url.pathname.endsWith('/restore_backup_extras')) return json(null)
    if (url.pathname.endsWith('/visit_tracks')) {
      if (options.method === 'GET') return json([])
      attempts++; assert.ok(new Headers(options.headers).get('prefer').includes('resolution=ignore-duplicates'))
      if (failed) { failed = false; return json({ message: 'Network failure' }, 400) }
      return new Response(null, { status: 201 })
    }
    throw Error(url.pathname)
  })
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).pending, 1)
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).pending, 0)
  assert.equal(attempts, 2)
})

test('photo restore reuses an uploaded object after a lost link response', async () => {
  const m = manifest()
  m.visits[0].photo = { entry: 'photos/0.png', size: png.length, type: 'image/png', sha256: await crypto.subtle.digest('SHA-256', png).then(hash => Buffer.from(hash).toString('hex')) }
  const file = archive(m, { 'photos/0.png': png }), preview = await inspectBackup(file, summits)
  let uploaded = false, linked = false, writes = 0, patches = 0
  const client = clientFor((url, options) => {
    if (url.pathname.endsWith('/restore_backup_visits')) return json([{ source_key: 'first:canigo', visit: { ...visits[0], photo_path: linked ? 'already-linked.png' : null }, created: false }])
    if (url.pathname.endsWith('/restore_backup_extras')) return json(null)
    if (url.pathname.endsWith('/visit_tracks')) return json([])
    if (url.pathname.endsWith('/can_upload_summit_photo')) return json(true)
    if (url.pathname.includes('/object/')) {
      if (options.method === 'POST') { writes++; uploaded = true; return json({ Key: url.pathname }) }
      return uploaded ? new Response(png) : json({ message: 'Not found' }, 404)
    }
    if (url.pathname.endsWith('/ascent_records')) {
      patches++; assert.equal(url.searchParams.get('photo_path'), 'is.null'); assert.equal(url.searchParams.get('user_id'), `eq.${owner}`)
      if (patches === 1) return json({ message: 'Lost link response' }, 400)
      linked = true; return json([{ summit_id: 'canigo' }])
    }
    throw Error(url.pathname)
  })
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).pending, 1)
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).pending, 0)
  assert.equal((await restoreBackup(client, owner, file, preview, () => {})).pending, 0)
  assert.equal(writes, 1); assert.equal(patches, 2)
})
