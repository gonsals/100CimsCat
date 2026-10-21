// All accounts, native sharing and clipboard writes are simulated. No messages are sent.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const catalog = require('../data/summits.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3000'
const output = path.join(__dirname, '../.npm-cache/progress-share-check')
const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'private-share-test@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`
const session = { access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
const labels = {
  ca: { open: 'Compartir progrés', share: 'Compartir imatge', copy: 'Copiar imatge', retry: 'Tornar-ho a provar', failed: 'No s’ha pogut crear la targeta. Torna-ho a provar.' },
  es: { open: 'Compartir progreso', share: 'Compartir imagen', copy: 'Copiar imagen', retry: 'Volver a intentar', failed: 'No se ha podido crear la tarjeta. Vuelve a intentarlo.' },
  en: { open: 'Share progress', share: 'Share image', copy: 'Copy image', retry: 'Try again', failed: 'Could not create the card. Please try again.' },
}

async function fixture(browser, options) {
  const page = await browser.newPage({ viewport: { width: options.width, height: 900 } })
  const selected = [...catalog.filter(s => s.essential).slice(0, options.essential), ...catalog.filter(s => !s.essential).slice(0, options.extra)]
  const records = selected.map(s => ({ summit_id: s.id, completed_at: '2026-10-01', photo_path: null, notes: 'PRIVATE_NOTE_DO_NOT_SHARE' }))
  const visits = Array.from({ length: options.repeats }, (_, i) => ({ ...records[0], id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }))
  const downloads = [], errors = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(({ session, options }) => {
    localStorage.setItem('100cimscat-language', options.language)
    localStorage.setItem('100cimscat-theme', options.theme || 'light')
    document.cookie = `sb-rpizylcabvqzvmdqywyp-auth-token=base64-${btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
    window.shareMode = options.mode || 'success'; window.shareCalls = []; window.copyCalls = []; window.cardTexts = []; window.revoked = []
    const draw = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (...args) { window.cardTexts.push(String(args[0])); return draw.apply(this, args) }
    const decode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function () { return window.failCard && !this.isConnected ? Promise.reject(new Error('Fixture terrain failure')) : decode.call(this) }
    const revoke = URL.revokeObjectURL
    URL.revokeObjectURL = function (url) { window.revoked.push(url); revoke.call(URL, url) }
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => window.shareMode !== 'unsupported' && data.files?.length === 1 && data.files[0].type === 'image/png' })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      const file = data.files[0]
      const call = { activation: navigator.userActivation.isActive, name: file.name, type: file.type, size: file.size, title: data.title }
      window.shareCalls.push(call)
      if (window.shareMode === 'cancel') throw new DOMException('Canceled', 'AbortError')
      if (window.shareMode === 'error') throw new DOMException('Blocked', 'NotAllowedError')
      call.png = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })
    } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => { const blob = await items[0].getType('image/png'); window.copyCalls.push({ type: blob.type, size: blob.size }) } } })
  }, { session, options })
  await page.route('https://*.supabase.co/**', route => {
    const url = route.request().url()
    if (route.request().method() !== 'GET') throw new Error('Unexpected account mutation in sharing test')
    const json = url.includes('/rest/v1/summits') ? catalog : url.includes('/rest/v1/ascent_records') ? records : url.includes('/rest/v1/ascent_visits') ? visits : url.includes('/rest/v1/summit_favorites') ? [] : url.includes('/auth/v1/user') ? user : []
    return route.fulfill({ json })
  })
  await page.goto(base)
  await page.getByRole('button', { name: labels[options.language].open, exact: true }).click()
  return { page, downloads, errors, summits: selected.length, visits: records.length + visits.length }
}

async function preview(page) {
  await page.locator('.progress-share-preview').evaluate(image => image.decode())
  return page.locator('.progress-share-dialog')
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const report = []
  try {
    for (const options of [
      { width: 320, language: 'ca', essential: 0, extra: 0, repeats: 0 },
      { width: 390, language: 'es', essential: 37, extra: 15, repeats: 2 },
      { width: 1280, language: 'en', essential: 150, extra: 372, repeats: 7, theme: 'dark' },
    ]) {
      const { page, downloads, errors, summits, visits } = await fixture(browser, options)
      const dialog = await preview(page), t = labels[options.language]
      assert.equal(await page.evaluate(() => window.shareCalls.length), 0, 'Opening preview must not share or download')
      await dialog.getByRole('button', { name: t.share, exact: true }).click()
      await page.waitForFunction(() => window.shareCalls[0]?.png)
      const call = await page.evaluate(() => window.shareCalls[0])
      assert.equal(call.activation, true, 'Native sharing must retain the tap activation')
      assert.equal(call.type, 'image/png')
      const png = Buffer.from(call.png.split(',')[1], 'base64')
      const metadata = await sharp(png).metadata()
      assert.deepEqual([metadata.width, metadata.height], [1080, 1350])
      fs.writeFileSync(path.join(output, `card-${options.language}-${options.essential}.png`), png)
      const text = await page.evaluate(() => window.cardTexts.join('|'))
      assert.ok(!/PRIVATE_NOTE|example\.invalid|2026-10-01/.test(text), 'Private information reached canvas')
      for (const value of [options.essential, summits, visits]) assert.ok(text.split('|').includes(String(value)), `Missing ${value}`)
      if (process.env.AXE_SCRIPT) {
        await page.addScriptTag({ path: process.env.AXE_SCRIPT })
        const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))
        assert.deepEqual(violations, [])
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: path.join(output, `dialog-${options.width}.png`) })
      await page.evaluate(() => { window.shareMode = 'cancel' })
      await dialog.getByRole('button', { name: t.share, exact: true }).click()
      assert.equal(await dialog.getByRole('status').count(), 0, 'Canceling must be silent')
      await page.evaluate(() => { window.shareMode = 'error' })
      await dialog.getByRole('button', { name: t.share, exact: true }).click()
      await dialog.getByRole('status').waitFor()
      const url = await page.locator('.progress-share-preview').getAttribute('src')
      await page.keyboard.press('Escape')
      await page.locator('.progress-share-dialog').waitFor({ state: 'detached' })
      assert.ok(await page.evaluate(url => window.revoked.includes(url), url))
      assert.equal(await page.getByRole('button', { name: t.open, exact: true }).evaluate(button => button === document.activeElement), true)
      assert.deepEqual(downloads, []); assert.deepEqual(errors, [])
      report.push({ width: options.width, language: options.language, figures: { essential: options.essential, summits, visits }, nativePngShare: true, freshActivation: true, cancelIsSilent: true, noDownloads: true, noPrivateDetails: true, focusAndCleanup: true })
      await page.close()
    }
    const { page, downloads, errors } = await fixture(browser, { width: 390, language: 'es', essential: 1, extra: 0, repeats: 1, mode: 'unsupported' })
    const dialog = await preview(page)
    assert.equal(await dialog.getByRole('button', { name: 'Compartir imagen', exact: true }).count(), 0)
    await dialog.getByRole('button', { name: 'Copiar imagen', exact: true }).click()
    await page.waitForFunction(() => window.copyCalls.length === 1)
    assert.equal((await page.evaluate(() => window.copyCalls[0])).type, 'image/png')
    assert.deepEqual(downloads, []); assert.deepEqual(errors, [])
    await page.keyboard.press('Escape')
    await page.evaluate(() => { window.failCard = true })
    await page.getByRole('button', { name: 'Compartir progreso', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: labels.es.failed }).waitFor()
    await page.evaluate(() => { window.failCard = false })
    await page.getByRole('button', { name: labels.es.retry, exact: true }).click()
    await preview(page)
    assert.deepEqual(downloads, [])
    await page.close()
    const result = { url: base, report, unsupportedBrowserCopiesWithoutDownload: true, preparationFailureRetries: true }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
