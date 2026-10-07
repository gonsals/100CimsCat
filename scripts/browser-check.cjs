// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
// Personal data is mocked in the browser; no real account or journal is modified.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const catalog = require('../data/summits.json')
const baseUrl = process.env.CHECK_URL || 'http://127.0.0.1:3000'
const output = process.env.CHECK_OUTPUT || path.join(__dirname, '../.next/browser-check')
const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'browser-check@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })}.browser-test-only`
const session = { access_token: token, refresh_token: 'browser-test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] })
  const report = []
  try {
    for (const width of [320, 375, 390, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, geolocation: { latitude: 41.38, longitude: 2.17 }, permissions: ['geolocation'] })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') console.log('console:', message.text().slice(0, 350)) })
      page.on('requestfailed', request => console.log('request failed:', request.url(), request.failure()?.errorText))
      page.on('response', response => { if (response.status() >= 400) console.log('http:', response.status(), response.url()) })
      await page.addInitScript(value => {
        localStorage.setItem('100cimscat-language', 'es')
        document.cookie = `sb-rpizylcabvqzvmdqywyp-auth-token=base64-${btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
      }, session)
      let ascents = [{ summit_id: 'canigo', completed_at: '2024-02-29', photo_path: null, notes: 'Recuerdo de prueba' }]
      let favorites = [{ summit_id: 'balandrau' }]
      let testPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
      await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/png', body: testPng }))
      await page.route('**/api/commons?*', route => route.fulfill({ json: { query: { pages: {} } } }))
      await page.route('https://*.supabase.co/**', async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method()
        const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } })
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
        if (url.pathname.includes('/auth/v1/user')) return json(user)
        if (url.pathname.includes('/auth/v1/token')) return json(session)
        if (url.pathname.includes('/auth/v1/logout')) return json({})
        if (url.pathname.includes('/rest/v1/summits')) return json(catalog)
        if (url.pathname.includes('/rest/v1/ascent_records')) {
          if (method === 'GET') return json(ascents)
          if (method === 'POST') { const record = request.postDataJSON(); const old = ascents.find(row => row.summit_id === record.summit_id); const updated = { photo_path: null, ...old, ...record }; ascents = ascents.filter(row => row.summit_id !== record.summit_id).concat(updated); return json(updated) }
          if (method === 'PATCH') { const id = url.searchParams.get('summit_id').replace('eq.', ''); const changes = request.postDataJSON(); ascents = ascents.map(row => row.summit_id === id ? { ...row, ...changes } : row); return json(ascents.find(row => row.summit_id === id)) }
          if (method === 'DELETE') { const id = url.searchParams.get('summit_id').replace('eq.', ''); ascents = ascents.filter(row => row.summit_id !== id); return json([{ summit_id: id }]) }
        }
        if (url.pathname.includes('/rest/v1/summit_favorites')) {
          if (method === 'GET') return json(favorites)
          if (method === 'POST') { const record = request.postDataJSON(); favorites.push(record); return json([record]) }
          if (method === 'DELETE') { const id = url.searchParams.get('summit_id').replace('eq.', ''); favorites = favorites.filter(row => row.summit_id !== id); return json([{ summit_id: id }]) }
        }
        if (url.pathname.includes('/rpc/get_my_photo_storage_bytes')) return json(0)
        if (url.pathname.includes('/rpc/can_upload_summit_photo')) return json(true)
        if (url.pathname.includes('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/summit-photos/browser-test.png?token=test' })
        if (url.pathname.includes('/storage/v1/object/')) return json({ Key: 'summit-photos/browser-test.png', Id: 'test' })
        return json({})
      })
      await page.goto(baseUrl)
      // The test cookie is created after the initial HTTP request, before hydration.
      try { await page.getByRole('heading', { name: 'Historial y estadísticas' }).waitFor({ timeout: 20000 }) }
      catch (error) { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.log((await page.locator('body').innerText()).slice(0, 1800)); console.log({ errors, cookies: (await context.cookies()).map(cookie => cookie.name) }); throw error }
      testPng = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; const context = canvas.getContext('2d'); context.fillStyle = '#426a4a'; context.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/png').split(',')[1] }), 'base64')
      const overflow = () => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, offenders: [...document.querySelectorAll('main *')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1 }).slice(0, 8).map(element => element.className) }))
      let sizes = await overflow()
      assert.ok(sizes.scroll <= sizes.width + 1, `Overflow at ${width}: ${JSON.stringify(sizes)}`)
      const search = page.getByRole('searchbox', { name: 'Buscar por cima o comarca' })
      await search.fill('canigo')
      await page.locator('.card').first().waitFor()
      assert.equal(await page.locator('.card').count(), 1)
      await page.getByRole('button', { name: 'Pendientes', exact: true }).click()
      assert.equal(await page.locator('.card').count(), 0)
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).first().click()
      await page.getByRole('button', { name: 'Pendientes', exact: true }).click()
      await page.getByRole('button', { name: '✦ Esenciales', exact: true }).click()
      await page.getByRole('button', { name: '☆ Favoritos', exact: true }).click()
      assert.equal(await page.locator('.card').count(), 1)
      assert.match(await page.locator('.card h3').innerText(), /Balandrau/)
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).first().click()
      await search.fill('canigo')
      await page.getByRole('button', { name: 'Editar ascensión: Canigó', exact: true }).last().click()
      await page.getByRole('textbox', { name: 'Notas personales' }).fill('Ruta; "bonita"\nCon amigos')
      await page.getByLabel('Fecha de la ascensión', { exact: true }).fill('2023-06-15')
      await page.locator('.ascent-editor').screenshot({ path: path.join(output, `editor-${width}.png`) })
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor').waitFor({ state: 'detached' })
      assert.equal(ascents[0].completed_at, '2023-06-15')
      assert.equal(ascents[0].notes, 'Ruta; "bonita"\nCon amigos')
      await page.getByLabel('Subir una foto de Canigó').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: testPng })
      try { await page.locator('.toast').filter({ hasText: 'Foto optimizada y guardada.' }).waitFor() }
      catch (error) { console.log('Photo feedback:', await page.locator('.toast').innerText()); throw error }
      assert.equal(ascents[0].completed_at, '2023-06-15')
      assert.equal(ascents[0].notes, 'Ruta; "bonita"\nCon amigos')
      assert.ok(ascents[0].photo_path)
      await page.getByRole('button', { name: 'Añadir a favoritos: Canigó', exact: true }).click()
      await page.getByRole('button', { name: 'Quitar de favoritos: Canigó', exact: true }).waitFor()
      const downloaded = page.waitForEvent('download')
      await page.getByRole('button', { name: /Exportar CSV/ }).click()
      const download = await downloaded
      const filename = path.join(output, `journal-${width}.csv`)
      await download.saveAs(filename)
      const content = fs.readFileSync(filename, 'utf8')
      assert.ok(content.includes('2023-06-15') && content.includes('Con amigos') && content.includes('Balandrau'))
      await page.getByRole('button', { name: 'Editar ascensión: Canigó', exact: true }).last().click()
      await page.getByRole('button', { name: 'Desmarcar cima', exact: true }).click()
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
      assert.equal(ascents.length, 1)
      await page.getByRole('button', { name: 'Desmarcar cima', exact: true }).click()
      await page.getByRole('button', { name: 'Sí, eliminar ascensión', exact: true }).click()
      await page.locator('.ascent-editor').waitFor({ state: 'detached' })
      assert.equal(ascents.length, 0)
      await page.getByRole('button', { name: 'Registrar ascensión: Canigó', exact: true }).click()
      await page.getByLabel('Fecha de la ascensión', { exact: true }).fill('2024-03-12')
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
      await page.locator('.ascent-editor').waitFor({ state: 'detached' })
      assert.equal(ascents.length, 1)
      await page.getByRole('button', { name: 'Explorar cima ↗', exact: true }).click()
      await page.locator('dialog.summit-modal').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('dialog.summit-modal').waitFor({ state: 'detached' })
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).first().click()
      await page.locator('.nearby-filters summary').click()
      await page.getByLabel('O elige una cima de referencia').selectOption('canigo')
      await page.waitForFunction(() => document.querySelector('.sort-row select').value === 'distance')
      assert.equal(await page.locator('.card h3').first().innerText(), 'Canigó')
      await page.locator('.advanced-filters summary').click()
      await page.locator('.filter-fields select').selectOption('Ripollès')
      await page.getByLabel('Altitud mínima (m)').fill('2500')
      await page.getByLabel('Altitud máxima (m)').fill('2900')
      await page.addStyleTag({ content: '.card { content-visibility: visible !important; }' })
      await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true })
      sizes = await overflow()
      assert.ok(sizes.scroll <= sizes.width + 1, `Filter overflow at ${width}: ${JSON.stringify(sizes)}`)
      await page.getByRole('button', { name: 'Mapa', exact: true }).click()
      await page.locator('.leaflet-container').waitFor()
      await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].some(tile => tile.complete && tile.naturalWidth > 0), null, { timeout: 15000 })
      await page.locator('.summit-map-wrap').screenshot({ path: path.join(output, `map-${width}.png`) })
      sizes = await overflow()
      assert.ok(sizes.scroll <= sizes.width + 1, `Map overflow at ${width}: ${JSON.stringify(sizes)}`)
      assert.deepEqual(errors, [], `Browser errors at ${width}`)
      await page.getByRole('button', { name: 'Usar mi ubicación', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.origin-label')?.textContent.includes('Tu ubicación'))
      await page.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await page.getByLabel('Tema', { exact: true }).selectOption('dark')
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
      await page.getByLabel('Idioma', { exact: true }).selectOption('en')
      await page.getByRole('heading', { name: 'History and statistics' }).waitFor()
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await page.locator('.catalog').screenshot({ path: path.join(output, `dark-${width}.png`) })
      report.push({ width, noOverflow: true, journal: true, favorites: true, csv: true, dateAndNotes: true, confirmDelete: true, nearby: true, map: true, errors })
      console.log(JSON.stringify(report.at(-1)))
      await context.close()
    }
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const guest = await guestContext.newPage()
    await guest.addInitScript(() => localStorage.setItem('100cimscat-language', 'es'))
    await guest.route('https://*.supabase.co/rest/v1/summits?*', route => route.fulfill({ json: catalog }))
    await guest.route('**/api/commons?*', route => route.fulfill({ json: { query: { pages: {} } } }))
    await guest.goto(baseUrl)
    await guest.locator('.card').first().waitFor()
    await guest.getByRole('searchbox').fill('canigo')
    await guest.getByRole('button', { name: 'Explorar cima ↗', exact: true }).click()
    await guest.locator('dialog.summit-modal').waitFor()
    await guest.getByRole('button', { name: 'Registrar ascensión', exact: true }).click()
    await guest.locator('.auth-modal').waitFor()
    assert.equal(await guest.locator('dialog.summit-modal').count(), 0)
    await guest.keyboard.press('Escape')
    await guest.locator('.auth-modal').waitFor({ state: 'detached' })
    await guestContext.close()
    console.log(JSON.stringify({ guestSignInFromDetails: true, escapeClosesDialog: true }))

    const recoveryContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const recovery = await recoveryContext.newPage()
    await recovery.addInitScript(value => {
      localStorage.setItem('100cimscat-language', 'es')
      document.cookie = `sb-rpizylcabvqzvmdqywyp-auth-token=base64-${btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
    }, session)
    let loadFails = true
    await recovery.route('https://*.supabase.co/**', route => {
      const request = route.request(), url = new URL(request.url())
      if (url.pathname.includes('/auth/v1/user')) return route.fulfill({ json: user })
      if (url.pathname.includes('/rest/v1/summits')) return route.fulfill({ json: catalog })
      if (request.method() === 'POST' || (loadFails && url.pathname.includes('/rest/v1/ascent_records'))) return route.fulfill({ status: 500, json: { message: 'Simulated connection failure' } })
      return route.fulfill({ json: [] })
    })
    await recovery.goto(baseUrl)
    await recovery.getByRole('button', { name: 'Volver a intentar', exact: true }).waitFor()
    assert.ok(await recovery.getByRole('button', { name: 'Registrar ascensión: Canigó', exact: true }).isDisabled())
    loadFails = false
    await recovery.getByRole('button', { name: 'Volver a intentar', exact: true }).click()
    await recovery.getByRole('heading', { name: 'Historial y estadísticas' }).waitFor()
    await recovery.getByRole('searchbox').fill('canigo')
    await recovery.getByRole('button', { name: 'Registrar ascensión: Canigó', exact: true }).click()
    await recovery.getByRole('textbox', { name: 'Notas personales' }).fill('This unsaved note must be kept')
    await recovery.getByRole('button', { name: 'Guardar', exact: true }).click()
    await recovery.locator('.ascent-editor .form-error').filter({ hasText: 'No se ha podido guardar la ascensión.' }).waitFor()
    assert.equal(await recovery.getByRole('textbox', { name: 'Notas personales' }).inputValue(), 'This unsaved note must be kept')
    assert.ok(await recovery.locator('.ascent-editor').isVisible())
    await recoveryContext.close()
    console.log(JSON.stringify({ loadFailureRecovery: true, failedSaveKeepsNotes: true }))
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
