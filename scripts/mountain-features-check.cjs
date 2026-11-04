// Browser + HTTP fixtures; SQL policies are checked separately against Supabase.
// No real account, credentials, storage objects or messages are used.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const catalog = require('../data/summits.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3101'
const origin = process.env.CHECK_SUPABASE_ORIGIN || 'http://127.0.0.1:3102'
const owner = '00000000-0000-4000-8000-000000000001'
const listId = '00000000-0000-4000-8000-000000000002'
const token = '00000000-0000-4000-8000-000000000003'
const user = { id: owner, email: 'mountain-check@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const expires = Math.floor(Date.now() / 1000) + 3600
const session = { access_token: `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: owner, aud: 'authenticated', role: 'authenticated', exp: expires })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
const cookieName = `sb-${new URL(origin).hostname.split('.')[0]}-auth-token`
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
const gpx = '<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="42" lon="2"><ele>100</ele></trkpt><trkpt lat="42.01" lon="2.01"><ele>130</ele></trkpt></trkseg></trk></gpx>'
const output = path.join(__dirname, '../.npm-cache/mountain-check')
let state, activePage
function reset() {
  state = { records: [{ summit_id: 'canigo', completed_at: '2024-02-29', notes: 'Original private note', photo_path: `${owner}/canigo/keep.png` }], visits: [], goals: [], tracks: [], lists: [{ id: listId, name: 'Weekend', planned_on: '2027-06-01', notes: 'PRIVATE PLAN', summitIds: ['canigo', 'balandrau'] }], shared: null, favorites: ['canigo'], photos: new Map([[`${owner}/canigo/keep.png`, png]]), receipts: new Map(), syncIds: [], loseSync: true, loseRestore: true, failPhoto: true, restoreIds: [] }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', '*')
  const json = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
  const failure = () => json({ message: 'Intentional fixture failure' }, 400)
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
    const url = new URL(req.url, origin), table = url.pathname.split('/').pop()
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks), body = req.headers['content-type']?.includes('application/json') && raw.length ? JSON.parse(raw) : null
    if (table === 'user') return json(user)
    if (table === 'token') return json(session)
    if (table === 'logout') return json({})
    if (table === 'summits') return json(catalog)
    if (table === 'ascent_records' || table === 'ascent_visits') {
      const rows = table === 'ascent_records' ? state.records : state.visits
      if (req.method === 'PATCH') {
        const key = url.searchParams.has('id') ? 'id' : 'summit_id', value = url.searchParams.get(key)?.slice(3)
        const row = rows.find(r => r[key] === value && !r.photo_path)
        if (row) Object.assign(row, body)
        return json(row ? [row] : [])
      }
      return json(rows)
    }
    if (table === 'summit_favorites') return json(state.favorites.map(summit_id => ({ summit_id })))
    if (table === 'journal_goals') {
      if (req.method === 'POST') { state.goals = state.goals.filter(g => g.year !== body.year).concat(body); return json(null) }
      return json(state.goals)
    }
    if (table === 'visit_tracks') {
      if (req.method === 'POST') { assert.equal(body.user_id, owner); state.tracks = state.tracks.filter(t => t.visit_key !== body.visit_key).concat(body); return json(null) }
      const key = url.searchParams.get('visit_key')?.slice(3)
      return json(key ? state.tracks.find(t => t.visit_key === key) ?? null : state.tracks)
    }
    if (table === 'trip_lists') return json(state.lists.map(l => ({ ...l, trip_list_summits: l.summitIds.map((summit_id, position) => ({ summit_id, position })) })))
    if (table === 'shared_trips') {
      if (req.method === 'DELETE') { state.shared = null; return json(null) }
      if (url.searchParams.has('source_list_id')) return json(state.shared ? { token } : null)
      assert.equal(req.headers['x-share-token'], token)
      return json(state.shared)
    }
    if (table === 'publish_trip') { assert.equal(body.p_expected_user, owner); state.shared = { token, title: state.lists[0].name, planned_on: state.lists[0].planned_on, summit_ids: state.lists[0].summitIds, expires_at: '2099-01-01T00:00:00Z' }; return json(state.shared) }
    if (table === 'sync_pending_visit') {
      assert.equal(body.p_expected_user, owner); state.syncIds.push(body.p_id)
      let row = state.visits.find(v => v.id === body.p_id)
      if (!row) { row = { id: body.p_id, summit_id: body.p_summit, completed_at: body.p_date, notes: body.p_notes, photo_path: null }; state.visits.push(row) }
      if (state.loseSync && state.syncIds.length === 2) { state.loseSync = false; return failure() }
      return json(row)
    }
    if (table === 'restore_backup_visits') {
      assert.equal(body.p_expected_user, owner); state.restoreIds.push(body.p_backup)
      const restored = body.p_rows.map(row => {
        const key = `${body.p_backup}:${row.source_key}`
        let saved = state.receipts.get(key), created = false
        if (!saved) { saved = { id: crypto.randomUUID(), summit_id: row.summit_id, completed_at: row.completed_at, notes: row.notes, photo_path: null }; state.visits.push(saved); state.receipts.set(key, saved); created = true }
        return { source_key: row.source_key, visit: saved, created }
      })
      if (state.loseRestore) { state.loseRestore = false; return failure() }
      return json(restored)
    }
    if (table === 'restore_backup_extras') {
      assert.equal(body.p_expected_user, owner)
      state.favorites = [...new Set([...state.favorites, ...body.p_favorites])]
      for (const list of body.p_lists) if (!state.lists.some(l => l.id === list.id || l.id === list.source_id)) state.lists.push(list)
      for (const goal of body.p_goals) if (!state.goals.some(g => g.year === goal.year)) state.goals.push(goal)
      return json(null)
    }
    if (table === 'can_upload_summit_photo') return json(true)
    if (url.pathname.includes('/object/sign/')) {
      if (req.method === 'POST') return json(body.paths.map(p => ({ path: p, signedURL: `/object/sign/summit-photos/${p}?token=fixture` })))
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(png)
    }
    if (url.pathname.includes('/object/')) {
      const key = decodeURIComponent(url.pathname.split('/summit-photos/')[1] ?? '')
      if (req.method === 'POST') {
        if (state.failPhoto) { state.failPhoto = false; return failure() }
        state.photos.set(key, png); return json({ Key: key })
      }
      const photo = state.photos.get(key)
      if (!photo) return json({ message: 'Not found' }, 404)
      res.writeHead(200, { 'content-type': 'image/png' }); return res.end(photo)
    }
    return json([])
  } catch (error) { console.error(error); return json({ message: error.message }, 500) }
})
async function fixture(browser, width, language = 'es') {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage(); activePage = page
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', route => [new URL(base).origin, new URL(origin).origin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
  await page.route('**tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/summit-context?*', route => route.fulfill({ json: { description: {}, photo: null } }))
  await page.addInitScript(({ language, session, cookieName }) => {
    localStorage.setItem('100cimscat-language', language)
    document.cookie = `${cookieName}=base64-${btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.fixtureCopied = text } } })
  }, { language, session, cookieName })
  return { context, page, errors }
}
const noOverflow = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
async function main() {
  fs.mkdirSync(output, { recursive: true }); reset()
  let nextServer, browser
  const report = []
  try {
  if (process.env.CHECK_START_SERVER === '1') {
    const log = fs.openSync(path.join(output, 'server.log'), 'w')
    nextServer = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', new URL(base).port], { cwd: path.join(__dirname, '..'), windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-fixture-public-key' } })
    const deadline = Date.now() + 20000
    try {
      while (true) {
        if (nextServer.exitCode !== null) throw Error('Test server exited')
        try { await fetch(base); break } catch (error) { if (Date.now() >= deadline) throw error }
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } catch (error) { nextServer.kill(); fs.closeSync(log); throw error }
    fs.closeSync(log)
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(new URL(origin).port), '127.0.0.1', resolve) })
  browser = await chromium.launch({ channel: 'chrome', headless: true })
    if (process.env.CHECK_SKIP_MOUNTAIN !== '1') {
    for (const width of [320, 390, 1280]) {
      reset(); const { context, page, errors } = await fixture(browser, width)
      await page.goto(base); await page.locator('#quadern').waitFor()
      assert.equal(await page.locator('.journal-tools').getAttribute('open'), null)
      await page.locator('.journal-tools > summary').click()
      // Annual goals and calendar preserve repeated visit semantics.
      const insights = page.getByRole('region', { name: 'Objetivos y calendario' })
      await insights.locator('summary').filter({ hasText: 'Objetivo anual' }).click()
      await insights.getByLabel('Año', { exact: true }).fill('2024')
      await insights.getByLabel('Tipo de objetivo').selectOption('unique')
      await insights.getByLabel('Objetivo', { exact: true }).fill('2')
      await insights.getByRole('button', { name: 'Guardar', exact: true }).click()
      await insights.getByRole('status').filter({ hasText: '1 / 2' }).waitFor()
      await insights.locator('summary').filter({ hasText: 'Calendario de ascensiones' }).click()
      await insights.getByLabel('Mes', { exact: true }).fill('2024-02')
      await insights.getByRole('button', { name: '2024-02-29: 1', exact: true }).click()
      await insights.getByRole('button', { name: /Canigó.*2024-02-29/ }).waitFor()
      await noOverflow(page)
      // GPX is parsed in the browser, shown on map and profile, then persisted.
      await page.locator('.history-list').getByRole('button', { name: 'Ruta GPX', exact: true }).first().click()
      const dialog = page.locator('.feature-dialog')
      await dialog.getByLabel('Archivo GPX').setInputFiles({ name: 'bad.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx/>') })
      await dialog.getByRole('alert').waitFor()
      await dialog.getByLabel('Archivo GPX').setInputFiles({ name: 'route.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) })
      await dialog.locator('.gpx-map .leaflet-container').waitFor(); await dialog.locator('.track-profile').waitFor()
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.feature-dialog button.primary-button')?.disabled)
      assert.equal(state.tracks.length, 1); assert.equal(state.tracks[0].visit_key, 'first:canigo')
      await noOverflow(page); await page.screenshot({ path: path.join(output, `${width}-gpx.png`) })
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
      // Public rendering uses the real Next server and a token-gated HTTP fixture.
      await page.getByRole('button', { name: 'Compartir salida', exact: true }).click()
      await dialog.getByRole('button', { name: 'Crear o actualizar enlace' }).click()
      await dialog.getByRole('button', { name: 'Copiar enlace' }).click()
      assert.equal(await page.evaluate(() => window.fixtureCopied), `${base}/sortides/${token}`)
      const shared = await context.newPage(), response = await shared.goto(`${base}/sortides/${token}`)
      assert.equal(response.status(), 200)
      await shared.getByRole('heading', { name: 'Weekend', exact: true }).waitFor()
      assert.ok(!(await shared.locator('main').innerText()).includes('PRIVATE PLAN'))
      assert.ok((await shared.locator('meta[name=robots]').getAttribute('content')).includes('noindex'))
      assert.equal(await shared.locator('meta[name=referrer]').getAttribute('content'), 'no-referrer')
      await noOverflow(shared); await shared.close()
      await dialog.getByRole('button', { name: 'Desactivar enlace' }).click()
      const revoked = await context.newPage(); await revoked.goto(`${base}/sortides/${token}`)
      await revoked.getByText('Este enlace ha caducado o ya no está disponible.').waitFor(); await revoked.close()
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
      // Install offline assets, really go offline, reload and record a visit.
      await page.locator('.offline-journal > details > summary').click()
      await page.getByRole('button', { name: 'Activar en este dispositivo' }).click()
      await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated')
      await context.setOffline(true); await page.goto(`${base}/offline.html`)
      await page.getByLabel('Cima', { exact: true }).selectOption('balandrau')
      await page.getByLabel('Fecha', { exact: true }).fill('2024-03-01')
      await page.getByLabel('Notas (máximo 4.000 caracteres)').fill('Offline private note')
      await page.getByRole('button', { name: 'Guardar pendiente', exact: true }).click()
      await page.getByText('Visita pendiente guardada.', { exact: true }).waitFor()
      await page.getByLabel('Fecha', { exact: true }).fill('2024-03-02')
      await page.getByLabel('Notas (máximo 4.000 caracteres)').fill('Second offline private note')
      await page.getByRole('button', { name: 'Guardar pendiente', exact: true }).click()
      await page.waitForFunction(() => document.querySelectorAll('#pending-journal li').length === 2)
      await page.reload(); await page.getByRole('button', { name: 'Eliminar pendiente', exact: true }).first().waitFor()
      assert.equal(await page.getByRole('button', { name: 'Eliminar pendiente', exact: true }).count(), 2)
      await context.setOffline(false); await page.goto(base)
      const offline = page.getByRole('region', { name: 'Visitas sin cobertura' })
      await offline.getByText('No se ha podido sincronizar. Se conservan las visitas pendientes.').waitFor()
      assert.equal(await offline.locator('.pending-visits li').count(), 1)
      await offline.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click()
      await offline.getByText('Visitas sincronizadas.', { exact: true }).waitFor()
      assert.equal(state.visits.length, 2); assert.equal(state.syncIds.length, 3); assert.equal(state.syncIds[1], state.syncIds[2])
      // Complete ZIP and preview, with failed metadata response and photo retry.
      await page.locator('.journal-tools > summary').click()
      await page.getByRole('button', { name: 'Copia de seguridad', exact: true }).click()
      const downloadPromise = page.waitForEvent('download')
      await dialog.getByRole('button', { name: 'Descargar ZIP completo' }).click()
      const downloaded = await downloadPromise, zipPath = path.join(output, `${width}-backup.zip`)
      await downloaded.saveAs(zipPath); assert.ok(fs.statSync(zipPath).size > 500)
      state.records = []; state.visits = []; state.goals = []; state.tracks = []; state.lists = []; state.favorites = []; state.photos.clear()
      await dialog.getByLabel('Archivo de copia ZIP').setInputFiles(zipPath)
      await dialog.getByRole('button', { name: 'Restaurar copia', exact: true }).waitFor()
      await noOverflow(page); await page.screenshot({ path: path.join(output, `${width}-backup-preview.png`) })
      await dialog.getByRole('button', { name: 'Restaurar copia', exact: true }).click()
      await dialog.getByText('No se ha podido completar. Puedes reintentarlo.').waitFor()
      assert.equal(state.visits.length, 3)
      await dialog.getByRole('button', { name: 'Restaurar copia', exact: true }).click()
      await dialog.getByText('Hay adjuntos pendientes. Reintenta con el mismo ZIP para completarlos sin duplicados.').waitFor()
      await dialog.getByRole('button', { name: 'Restaurar copia', exact: true }).click()
      await dialog.getByText('Operación completada.', { exact: true }).waitFor()
      assert.equal(state.visits.length, 3); assert.equal(state.tracks.length, 1); assert.equal(state.photos.size, 1); assert.equal(state.lists.length, 1); assert.equal(state.goals.length, 1)
      assert.equal(new Set(state.restoreIds).size, 1)
      assert.ok(state.visits.some(v => v.notes === 'Original private note' && v.photo_path))
      assert.ok(state.visits.some(v => v.notes === 'Offline private note'))
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
      await page.reload(); await page.locator('.history-list').getByText('Offline private note', { exact: true }).waitFor()
      await noOverflow(page); assert.deepEqual(errors, [])
      report.push({ width, goals: true, calendar: true, gpxMapProfile: true, sharingAndRevocation: true, offlineReload: true, syncLostResponse: true, fullBackup: true, restoreLostResponse: true, attachmentRetry: true, errors })
      await context.close()
    }
    for (const [language, heading, backup] of [['ca', 'Objectius i calendari', 'Còpia de seguretat'], ['en', 'Goals and calendar', 'Backup']]) {
      reset(); const { context, page, errors } = await fixture(browser, 390, language)
      await page.goto(base); await page.locator('.journal-tools > summary').click(); await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      await page.getByRole('button', { name: backup, exact: true }).click(); await page.locator('.feature-dialog').waitFor()
      await noOverflow(page); assert.deepEqual(errors, []); await context.close(); report.push({ language, translated: true })
    }
    }
    if (process.env.CHECK_REGRESSIONS === '1') {
      for (const script of (process.env.CHECK_REGRESSION_SCRIPTS || 'planning-check.cjs,auth-check.cjs,product-check.cjs').split(',')) {
        await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [path.join(__dirname, script)], { windowsHide: true, stdio: 'inherit', env: { ...process.env, CHECK_URL: base, CHECK_SUPABASE_ORIGIN: origin } })
          child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(`${script} exited ${code}`)))
        })
        report.push({ regression: script, passed: true })
      }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ report, output }, null, 2))
  } catch (error) {
    if (activePage && !activePage.isClosed()) { await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); fs.writeFileSync(path.join(output, 'failure.txt'), await activePage.locator('body').innerText()) }
    throw error
  } finally { await browser?.close(); server.close(); nextServer?.kill() }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close() })
