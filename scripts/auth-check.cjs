// Private auth requests and WebCrypto failures are simulated. No email is sent.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../data/summits.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3101'
const supabaseOrigin = process.env.CHECK_SUPABASE_ORIGIN || 'https://auth-check.supabase.test'
const cookieName = `sb-${new URL(supabaseOrigin).hostname.split('.')[0]}-auth-token`
const output = path.join(__dirname, '../.npm-cache/auth-check')
const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, email: 'auth-check@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const expires = Math.floor(Date.now() / 1000) + 3600
const session = { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: expires })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }

async function fixture(browser, width, signedIn) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const state = { otpFails: true, logoutFails: true, releaseOtp: null, otpRequests: 0, logoutRequests: 0 }
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
  await page.route('**/api/summit-context?*', route => route.fulfill({ json: { description: {}, photo: null } }))
  await page.addInitScript(({ signedIn, session, cookieName }) => {
    localStorage.setItem('100cimscat-language', 'es')
    if (signedIn) document.cookie = `${cookieName}=base64-${btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}; path=/; SameSite=Lax`
    window.authCheck = { failCrypto: false, cryptoFailures: 0 }
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async (...args) => {
      if (window.authCheck.failCrypto) { window.authCheck.cryptoFailures++; throw new Error('Intentional WebCrypto exception') }
      return digest(...args)
    }
  }, { signedIn, session, cookieName })
  await page.route(`${supabaseOrigin}/**`, async route => {
    const request = route.request(), url = new URL(request.url())
    const json = value => route.fulfill({ json: value })
    const failure = () => route.fulfill({ status: 503, json: { message: 'Intentional auth fixture failure' } })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/user')) return json(user)
    if (url.pathname.endsWith('/token')) return json(session)
    if (url.pathname.endsWith('/otp')) {
      state.otpRequests++
      assert.equal(request.postDataJSON().email, 'retry@example.invalid')
      if (state.otpFails) return failure()
      await new Promise(resolve => { state.releaseOtp = resolve })
      return json({})
    }
    if (url.pathname.endsWith('/logout')) { state.logoutRequests++; return state.logoutFails ? failure() : json({}) }
    if (url.pathname.endsWith('/summits')) return json(catalog)
    if (url.pathname.endsWith('/ascent_records')) return json([{ summit_id: 'canigo', completed_at: '2024-01-01', photo_path: null, notes: 'Fixture journal' }])
    return json([])
  })
  return { context, page, errors, state }
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: process.env.CHECK_BROWSER_CHANNEL || 'chrome', headless: true })
  const report = []
  try {
    for (const width of [320, 390, 1280]) {
      const guest = await fixture(browser, width, false)
      const { page, state } = guest
      await page.goto(base)
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const email = dialog.getByLabel('Correo electrónico', { exact: true })
      const google = dialog.getByRole('button', { name: 'Continuar con Google', exact: true })
      const send = dialog.getByRole('button', { name: 'Envíame el enlace de acceso', exact: true })
      await email.fill('retry@example.invalid')
      await page.evaluate(() => { window.authCheck.failCrypto = true })
      for (let attempt = 1; attempt <= 2; attempt++) {
        await google.click()
        await dialog.locator('.google-error').waitFor()
        assert.ok(await google.isEnabled())
        assert.equal(await page.evaluate(() => window.authCheck.cryptoFailures), attempt)
      }
      await send.click()
      await dialog.locator('#auth-email-error').waitFor()
      assert.equal(await email.inputValue(), 'retry@example.invalid')
      assert.equal(await email.getAttribute('aria-invalid'), 'true')
      assert.ok(await google.isEnabled() && await send.isEnabled())
      assert.equal(state.otpRequests, 0)
      await page.evaluate(() => { window.authCheck.failCrypto = false })
      await send.click()
      await page.waitForFunction(() => document.getElementById('auth-email-error') && !document.querySelector('.auth-modal form button').disabled)
      assert.equal(state.otpRequests, 1)
      await dialog.screenshot({ path: path.join(output, `email-error-${width}.png`) })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      state.otpFails = false
      const otp = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/otp'))
      await send.click()
      await otp
      assert.ok(await google.isDisabled())
      assert.ok(await email.isDisabled())
      assert.ok(await dialog.locator('form button').isDisabled())
      assert.ok(state.releaseOtp)
      state.releaseOtp()
      await dialog.waitFor({ state: 'detached' })
      await page.getByRole('status').filter({ hasText: 'Te hemos enviado un enlace' }).waitFor()
      assert.equal(state.otpRequests, 2)
      assert.deepEqual(guest.errors, [])
      await guest.context.close()

      const account = await fixture(browser, width, true)
      await account.page.goto(base)
      await account.page.getByRole('heading', { name: 'Historial y estadísticas', exact: true }).waitFor()
      await account.page.getByRole('button', { name: `Tu cuenta: ${user.email}`, exact: true }).click()
      const logout = account.page.getByRole('button', { name: 'Cerrar sesión', exact: true })
      await logout.click()
      await account.page.getByRole('status').filter({ hasText: 'Has cerrado la sesión en este dispositivo' }).waitFor()
      await account.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor()
      assert.equal(await account.page.locator('#quadern').count(), 0)
      assert.equal(account.state.logoutRequests, 1)
      assert.deepEqual(account.errors, [])
      await account.context.close()

      const success = await fixture(browser, width, true)
      success.state.logoutFails = false
      await success.page.goto(base)
      await success.page.getByRole('heading', { name: 'Historial y estadísticas', exact: true }).waitFor()
      await success.page.getByRole('button', { name: `Tu cuenta: ${user.email}`, exact: true }).click()
      await success.page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
      await success.page.getByRole('status').filter({ hasText: 'Has cerrado la sesión.' }).waitFor()
      await success.page.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor()
      assert.equal(await success.page.locator('#quadern').count(), 0)
      assert.equal(success.state.logoutRequests, 1)
      assert.deepEqual(success.errors, [])
      await success.context.close()
      report.push({ width, unexpectedExceptions: true, apiFailures: true, retry: true, pendingControls: true, localSignOutOnRemoteFailure: true, successfulSignOut: true, errors: [] })
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ report, output }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
