// Browser fixtures exercise private flows without touching real accounts or files.
// Optional AXE_SCRIPT points to a pinned axe-core browser bundle for WCAG checks.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../data/summits.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3000'
const output = path.join(__dirname, '../.next/product-check')
const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'product-check@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, email: user.email })}.fixture`
const session = { access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
const report = []
const errors = []
let png

async function check(page, name) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)))
  const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
  assert.ok(size.content <= size.width + 1, `${name}: overflow ${JSON.stringify(size)}`)
  if (process.env.AXE_SCRIPT) {
    await page.addScriptTag({ path: process.env.AXE_SCRIPT })
    const results = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })))
    fs.writeFileSync(path.join(output, `${name}-axe.json`), JSON.stringify(results, null, 2))
    assert.deepEqual(results, [], `${name}: accessibility violations`)
  }
  await page.screenshot({ path: path.join(output, `${name}.png`) })
  report.push({ name, noOverflow: true, accessibility: process.env.AXE_SCRIPT ? 'axe WCAG 2 A/AA + 2.1/2.2 AA' : 'not run' })
}

async function fixture(browser, width, signedIn = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ session, signedIn }) => {
    localStorage.setItem('100cimscat-language', 'es')
    if (signedIn) document.cookie = `sb-rpizylcabvqzvmdqywyp-auth-token=base64-${btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
  }, { session, signedIn })
  const state = { records: [], visits: [], inserts: 0, uploads: 0, removals: [], signings: 0, failUpload: false, failLink: false, photoMode: 'success' }
  await page.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('https://upload.wikimedia.org/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/summit-context?*', route => ['error', 'fallback'].includes(state.photoMode) ? route.fulfill({ status: 502, json: { error: 'Fixture' } }) : route.fulfill({ json: state.photoMode === 'empty' ? { description: {}, photo: null } : { entityUrl: 'https://www.wikidata.org/wiki/Q6650', description: { es: 'montaña de los Pirineos', en: 'mountain in the Pyrenees' }, photo: { url: 'https://upload.wikimedia.org/wikipedia/commons/test.png', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Test.png', author: 'Fixture author', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }))
  await page.route(/https:\/\/(www\.wikidata\.org|commons\.wikimedia\.org)\/w\/api\.php/, route => {
    assert.equal(route.request().headers().authorization, undefined)
    assert.equal(route.request().headers().cookie, undefined)
    if (state.photoMode === 'error') return route.fulfill({ status: 503, json: {}, headers: { 'access-control-allow-origin': '*' } })
    const url = new URL(route.request().url())
    const point = require('../data/summit-coordinates.json').canigo
    const entity = { id: 'Q6650', labels: { ca: { value: 'Canigó' } }, descriptions: { es: { value: 'montaña de los Pirineos' } }, claims: { P625: [{ mainsnak: { datavalue: { value: { latitude: point.lat, longitude: point.lng, globe: 'http://www.wikidata.org/entity/Q2' } } } }], P18: [{ mainsnak: { datavalue: { value: 'Test.png' } } }] } }
    const info = { thumburl: 'https://upload.wikimedia.org/wikipedia/commons/test.png', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.png', mime: 'image/png', extmetadata: { Artist: { value: 'Fixture author' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }
    const json = url.hostname === 'commons.wikimedia.org' ? { query: { pages: { 1: { imageinfo: [info] } } } } : url.searchParams.get('action') === 'wbsearchentities' ? { search: [{ id: 'Q6650' }] } : { entities: { Q6650: entity } }
    return route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route('https://*.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
    const failure = () => route.fulfill({ status: 503, json: { message: 'Intentional fixture failure', error: 'Unavailable' } })
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.includes('/auth/v1/user')) return json(signedIn ? user : { user: null })
    if (url.pathname.includes('/auth/v1/token')) return json(session)
    if (url.pathname.includes('/rest/v1/summits')) return json(catalog)
    if (/\/rest\/v1\/(ascent_records|ascent_visits)/.test(url.pathname)) {
      const key = url.pathname.includes('ascent_visits') ? 'visits' : 'records'
      if (method === 'GET') return json(state[key])
      if (method === 'POST') { state.inserts++; const record = { photo_path: null, ...(key === 'visits' ? { id: crypto.randomUUID() } : {}), ...request.postDataJSON() }; state[key].push(record); return json(record) }
      const id = url.searchParams.get(key === 'visits' ? 'id' : 'summit_id')?.replace('eq.', '')
      if (method === 'PATCH') {
        const changes = request.postDataJSON()
        if (changes.photo_path && state.failLink) { state.failLink = false; return failure() }
        state[key] = state[key].map(row => (key === 'visits' ? row.id : row.summit_id) === id ? { ...row, ...changes } : row)
        return json(state[key].find(row => (key === 'visits' ? row.id : row.summit_id) === id))
      }
    }
    if (url.pathname.includes('/rest/v1/summit_favorites')) return json([])
    if (url.pathname.includes('/rpc/get_my_photo_storage_bytes')) return json(0)
    if (url.pathname.includes('/rpc/can_upload_summit_photo')) return json(true)
    if (url.pathname.includes('/storage/v1/object/sign/') && method === 'GET') return route.fulfill({ contentType: 'image/png', body: png })
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      state.signings++
      const body = request.postDataJSON()
      return json(body.paths ? body.paths.map(p => ({ path: p, signedURL: `/object/sign/summit-photos/${p}?token=${state.signings}` })) : { signedURL: `/object/sign/summit-photos/test.png?token=${state.signings}` })
    }
    if (url.pathname.includes('/storage/v1/object/') && method === 'POST') { state.uploads++; if (state.failUpload) { state.failUpload = false; return failure() }; return json({ Key: 'fixture' }) }
    if (url.pathname.includes('/storage/v1/object/') && method === 'DELETE') { state.removals.push(...request.postDataJSON().prefixes); return json([]) }
    return json({})
  })
  return { context, page, state }
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const painter = await browser.newPage()
    png = Buffer.from(await painter.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#426a4a'; x.fillRect(0, 0, 64, 48); return c.toDataURL('image/png').split(',')[1] }), 'base64')
    await painter.close()
    for (const width of process.env.PRODUCT_ONLY_PRIVATE ? [] : [320, 390, 1280]) {
      const { context, page, state } = await fixture(browser, width)
      await page.goto(base)
      await page.getByRole('searchbox').waitFor()
      await check(page, `home-${width}`)
      await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await check(page, `settings-${width}`)
      await page.getByLabel('Tema', { exact: true }).selectOption('dark')
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
      await check(page, `home-dark-${width}`)
      await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await page.getByLabel('Tema', { exact: true }).selectOption('light')
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
      await check(page, `sign-in-${width}`)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Mapa', exact: true }).click()
      await page.locator('.summit-cluster-icon').first().waitFor()
      const represented = await page.evaluate(() => [...document.querySelectorAll('.summit-cluster-count small')].reduce((sum, node) => sum + Number(node.textContent.replace('/', '')), document.querySelectorAll('path.leaflet-interactive[role="button"]').length))
      const coordinates = require('../data/summit-coordinates.json')
      assert.equal(represented, catalog.filter(summit => coordinates[summit.id]).length)
      await check(page, `cluster-map-${width}`)
      await page.getByRole('searchbox').fill('canigo')
      const marker = page.getByRole('button', { name: 'Canigó, 2784 m', exact: true })
      await marker.waitFor()
      await check(page, `catalogue-map-${width}`)
      await marker.focus(); await page.keyboard.press('Enter')
      await page.locator('.summit-modal').waitFor()
      await page.locator('.summit-modal').getByText('Fixture author', { exact: false }).waitFor()
      await check(page, `map-details-${width}`)
      await page.keyboard.press('Escape')
      await page.goto(base + '/cims/canigo')
      await page.locator('.summit-reference figcaption').getByText('Fixture author').waitFor()
      await page.locator('.leaflet-container').waitFor()
      assert.match(await page.locator('.summit-reference figcaption').innerText(), /CC BY-SA 4.0/)
      assert.match(await page.locator('.summit-description').innerText(), /Pirineos/)
      await check(page, `summit-${width}`)
      await page.getByRole('button', { name: 'Ilustración', exact: true }).click()
      await page.waitForFunction(() => { const image = document.querySelector('.summit-reference img'); return image?.complete && image.naturalWidth > 0 && image.getAttribute('src')?.startsWith('/mountains/') })
      await page.getByText('Perfil generado con elevaciones reales.', { exact: false }).waitFor()
      await check(page, `terrain-illustration-${width}`)
      await page.getByRole('button', { name: 'Fotografía', exact: true }).click()
      await page.getByText('Fixture author', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
      await check(page, `summit-dark-${width}`)
      await page.getByLabel('Idioma', { exact: true }).selectOption('en')
      await page.getByRole('heading', { name: 'Plan your visit' }).waitFor()
      assert.equal(await page.locator('html').getAttribute('lang'), 'en')
      await page.getByLabel('Language', { exact: true }).selectOption('es')
      await page.getByRole('button', { name: 'Activar tema claro' }).click()
      state.photoMode = 'fallback'; await page.reload()
      await page.getByText('Fixture author', { exact: true }).waitFor()
      await check(page, `anonymous-photo-fallback-${width}`)
      state.photoMode = 'error'; await page.reload()
      await page.getByRole('button', { name: 'Volver a intentar', exact: true }).waitFor()
      state.photoMode = 'success'
      await page.getByRole('button', { name: 'Volver a intentar', exact: true }).click()
      await page.getByText('Fixture author', { exact: true }).waitFor()
      state.photoMode = 'empty'; await page.reload()
      await page.getByText('Perfil generado con elevaciones reales.', { exact: false }).waitFor()
      for (const section of ['projecte', 'ajuda', 'fonts', 'privacitat', 'contacte']) {
        await page.goto(`${base}/${section}`)
        await page.getByRole('heading', { level: 1 }).waitFor()
        if (['privacitat', 'contacte', 'projecte'].includes(section)) {
          await page.getByRole('heading', { name: 'Marc Gonzalez Tarrio' }).waitFor()
          assert.equal(await page.getByRole('link', { name: 'marcgonzaleztarrio@gmail.com' }).getAttribute('href'), 'mailto:marcgonzaleztarrio@gmail.com')
        }
        await check(page, `${section}-${width}`)
      }
      const response = await page.goto(base + '/pagina-que-no-existe')
      assert.equal(response.status(), 404)
      await page.getByRole('link', { name: 'Volver al catálogo', exact: true }).waitFor()
      await check(page, `404-${width}`)
      await context.close()
    }
    for (const width of [320, 390, 1280]) {
      const { context, page, state } = await fixture(browser, width, true)
      await page.goto(base)
      await page.getByRole('heading', { name: 'Historial y estadísticas' }).waitFor()
      await page.getByRole('tab', { name: /Galería/ }).click()
      await page.locator('#quadern').scrollIntoViewIfNeeded()
      await check(page, `empty-gallery-${width}`)
      await page.getByRole('searchbox').fill('canigo')
      await page.getByRole('button', { name: 'Registrar ascensión: Canigó', exact: true }).click()
      await page.getByLabel('Fecha de la ascensión', { exact: true }).fill('2024-05-02')
      await page.getByRole('textbox', { name: 'Notas personales' }).fill('Recuerdo conservado durante el reintento')
      await page.getByLabel('Foto opcional', { exact: true }).setInputFiles({ name: 'memory.png', mimeType: 'image/png', buffer: png })
      await check(page, `form-${width}`)
      await page.keyboard.press('Escape')
      await page.getByRole('heading', { name: '¿Descartar cambios pendientes?' }).waitFor()
      await page.getByRole('button', { name: 'Continuar editando', exact: true }).click()
      state.failUpload = true
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor .form-error').filter({ hasText: /está guardada/ }).waitFor()
      assert.equal(state.inserts, 1)
      assert.equal(await page.getByRole('textbox', { name: 'Notas personales' }).inputValue(), 'Recuerdo conservado durante el reintento')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor').waitFor({ state: 'detached' })
      assert.equal(state.inserts, 1); assert.equal(state.uploads, 2); assert.ok(state.records[0].photo_path)
      await page.getByRole('button', { name: 'Editar ascensión: Canigó', exact: true }).click()
      await page.getByRole('button', { name: 'Registrar otra ascensión', exact: true }).click()
      await page.getByLabel('Fecha de la ascensión', { exact: true }).fill('2025-06-03')
      await page.getByLabel('Foto opcional', { exact: true }).setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: png })
      state.failLink = true
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor .form-error').filter({ hasText: /está guardada/ }).waitFor()
      assert.equal(state.inserts, 2); assert.equal(state.removals.length, 1)
      assert.equal(state.visits[0].photo_path, null)
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor').waitFor({ state: 'detached' })
      assert.equal(state.inserts, 2); assert.ok(state.visits[0].photo_path)
      assert.equal(await page.locator('.photo-gallery figure').count(), 2)
      assert.equal(await page.locator('.photo-gallery time').first().getAttribute('datetime'), '2025-06-03')
      await page.locator('#quadern').scrollIntoViewIfNeeded()
      await check(page, `gallery-${width}`)
      await page.locator('.photo-gallery-open').first().click()
      await page.locator('.photo-viewer').waitFor()
      await check(page, `viewer-${width}`)
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.locator('.photo-viewer time').getAttribute('datetime'), '2024-05-02')
      const signings = state.signings
      await page.getByRole('button', { name: 'Actualizar foto', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('.photo-viewer-actions .text-button').disabled)
      assert.equal(state.signings, signings + 1)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.photo-viewer').count(), 0)
      assert.equal(await page.locator('.photo-gallery-open').first().evaluate(e => e === document.activeElement), true)
      await page.locator('.journal-year select').selectOption('2024')
      assert.equal(await page.locator('.photo-gallery figure').count(), 1)
      await page.locator('.photo-gallery-open').click()
      await page.getByRole('button', { name: 'Editar ascensión', exact: true }).click()
      assert.equal(await page.getByLabel('Fecha de la ascensión', { exact: true }).inputValue(), '2024-05-02')
      await page.getByRole('textbox', { name: 'Notas personales' }).fill('Discard this change')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click()
      assert.equal(state.records[0].notes, 'Recuerdo conservado durante el reintento')
      report.push({ width, photoRetryWithoutDuplicates: true, failedPhotoLinkCleanup: true, galleryIncludesRepeatedVisits: true, dateFilterAndNavigation: true, refreshPrivateUrl: true, draftProtectionAndFocus: true })
      await context.close()
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ checks: report.length, errors, privateFlows: report.filter(item => item.width), output }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
