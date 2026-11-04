const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createClient } = require('@supabase/supabase-js')
const exportsForTest = {}
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/trip-planning.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText
vm.runInNewContext(code, { exports: exportsForTest })
const { loadTripLists, saveTripList, importJournal } = exportsForTest
const userId = '00000000-0000-4000-8000-000000000001'
const list = { id: '00000000-0000-4000-8000-000000000002', name: '  Summer  ', notes: 'Private notes', planned_on: '2027-06-01', summitIds: ['canigo','balandrau'] }
const clientFor = read => createClient('https://fixture.supabase.test', 'test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input, options) => read(new URL(input), options) } })
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

test('planning loads all pages in stable order and restores summit positions', async () => {
  const offsets = []
  const client = clientFor(url => {
    assert.equal(url.searchParams.get('user_id'), `eq.${userId}`)
    assert.equal(url.searchParams.get('order'), 'created_at.asc,id.asc')
    const offset = Number(url.searchParams.get('offset'))
    offsets.push(offset)
    return json(Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({ id: `list-${offset+index}`, name: 'Trip', planned_on: null, notes: '', trip_list_summits: [{ summit_id: 'canigo', position: 1 }, { summit_id: 'balandrau', position: 0 }] })))
  })
  const lists = await loadTripLists(client, userId, () => true)
  assert.equal(lists.length, 101)
  assert.deepEqual(offsets, [0,100])
  assert.equal(lists[0].summitIds.join(','), 'balandrau,canigo')
})

test('saving uses a stable list id and binds the operation to the intended account', async () => {
  const client = clientFor((url, options) => {
    assert.ok(url.pathname.endsWith('/rpc/save_trip_list'))
    assert.deepEqual(JSON.parse(options.body), { p_id: list.id, p_name: 'Summer', p_planned_on: list.planned_on, p_notes: list.notes, p_summits: list.summitIds, p_expected_user: userId })
    return json(list.id)
  })
  const saved = await saveTripList(client, list, userId)
  assert.equal(saved.id, list.id)
  assert.equal(saved.name, 'Summer')
  assert.equal(list.name, '  Summer  ')
})

test('import sends only reviewed rows to an atomic RPC and requires a valid result', async () => {
  const rows = [{ summit_id: 'canigo', completed_at: '2024-01-01', notes: 'My note', favorite: true }]
  const client = clientFor((url, options) => {
    assert.ok(url.pathname.endsWith('/rpc/import_journal'))
    assert.deepEqual(JSON.parse(options.body), { p_rows: rows, p_expected_user: userId })
    return json({ visits: [], favorites: ['canigo'], skipped: 1 })
  })
  const result = await importJournal(client, rows, userId)
  assert.equal(result.skipped, 1)
  assert.equal(result.favorites[0], 'canigo')
  await assert.rejects(importJournal(clientFor(() => json({})), rows, userId))
  await assert.rejects(saveTripList(clientFor(() => json({ message: 'Denied' }, 403)), list, userId))
})
