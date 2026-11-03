const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createClient } = require('@supabase/supabase-js')

const exportsForTest = {}
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/journal-data.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText
vm.runInNewContext(compiled, { exports: exportsForTest })
const { loadJournal } = exportsForTest
const userId = '00000000-0000-4000-8000-000000000001'
const visit = index => ({ id: `visit-${index}`, summit_id: 'canigo', completed_at: '2024-01-01', photo_path: null })

function fixture({ count = 501, failedPage = false, failedSigning = false, afterPage = () => {} } = {}) {
  const calls = []
  const first = { summit_id: 'balandrau', completed_at: '2023-01-01', photo_path: `${userId}/balandrau/photo.webp` }
  const client = createClient('https://fixture.supabase.co', 'test-only-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input)
      calls.push({ url, options })
      const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      if (url.pathname.startsWith('/rest/v1/')) assert.equal(url.searchParams.get('user_id'), `eq.${userId}`)
      if (url.pathname.endsWith('/ascent_records')) return json([first])
      if (url.pathname.endsWith('/summit_favorites')) return json([{ summit_id: 'canigo' }])
      if (url.pathname.endsWith('/ascent_visits')) {
        const offset = Number(url.searchParams.get('offset') ?? 0)
        assert.equal(url.searchParams.get('limit'), '500')
        assert.equal(url.searchParams.get('order'), 'completed_at.desc,id.asc')
        if (failedPage && offset > 0) return json({ code: '42501', message: 'Fixture failure' }, 403)
        const rows = Array.from({ length: Math.max(0, Math.min(500, count - offset)) }, (_, i) => visit(offset + i))
        afterPage(offset)
        return json(rows)
      }
      assert.ok(url.pathname.endsWith('/object/sign/summit-photos'))
      assert.deepEqual(JSON.parse(options.body), { expiresIn: 86400, paths: [first.photo_path] })
      if (failedSigning) return json({ message: 'Fixture signing failure' }, 400)
      return json([{ path: first.photo_path, signedURL: '/object/sign/summit-photos/photo.webp?token=fixture', error: null }])
    } },
  })
  return { client, calls }
}

test('journal loads every page through the real SDK and combines visits, favorites and private URLs', async () => {
  const { client, calls } = fixture()
  const result = await loadJournal(client, userId, () => true)
  assert.equal(result.visits.length, 502)
  assert.equal(new Set(result.visits.filter(row => row.id).map(row => row.id)).size, 501)
  assert.ok(result.favorites.has('canigo'))
  assert.match(result.visits[0].photoUrl, /^https:\/\/fixture\.supabase\.co\/storage\/v1\/object\/sign\//)
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/ascent_visits')).length, 2)
})

test('a later page failure rejects the journal instead of returning incomplete progress', async () => {
  const { client, calls } = fixture({ failedPage: true })
  await assert.rejects(loadJournal(client, userId, () => true), error => error.code === '42501')
  assert.ok(calls.every(call => !call.url.pathname.includes('/storage/')))
})

test('journal cancellation stops pagination and private URL requests', async () => {
  let active = true
  const { client, calls } = fixture({ afterPage: () => { active = false } })
  assert.equal(await loadJournal(client, userId, () => active), null)
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/ascent_visits')).length, 1)
  assert.ok(calls.every(call => !call.url.pathname.includes('/storage/')))
})

test('unavailable private photo links preserve visits and favorites for URL renewal', async () => {
  const { client } = fixture({ count: 0, failedSigning: true })
  const result = await loadJournal(client, userId, () => true)
  assert.equal(result.visits.length, 1)
  assert.ok(result.visits[0].photo_path)
  assert.equal(result.visits[0].photoUrl, undefined)
  assert.ok(result.favorites.has('canigo'))
})
