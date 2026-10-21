// Public terrain assets only; no account or private journal is used.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../data/summits.json')
const artwork = require('../data/mountain-art.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3000'
const output = path.join(__dirname, '../.npm-cache/mountain-art-check')
const ids = ['pollego-superior-pedraforca', 'sant-jeroni', 'puigmal', 'canigo', 'matagalls', 'montcau', 'turo-de-montgat']

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const errors = [], terrainRequests = [], report = []
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => { if (/elevation-tiles-prod|geoserveis\.icgc/.test(request.url())) terrainRequests.push(request.url()) })
      await page.addInitScript(() => localStorage.setItem('100cimscat-language', 'es'))
      await page.route('https://*.supabase.co/**', route => route.fulfill({ json: route.request().url().includes('/rest/v1/summits') ? catalog : { user: null } }))
      await page.route('**/api/summit-context?*', route => route.fulfill({ json: { description: {}, photo: null } }))
      await page.route('https://*.tile.openstreetmap.org/**', route => route.abort())
      await page.goto(base)
      await page.getByRole('searchbox').fill('pedraforca')
      assert.equal(await page.locator('.card').count(), 2)
      const card = page.locator('.card').first()
      await card.scrollIntoViewIfNeeded()
      await card.locator('img').evaluate(image => image.decode())
      await page.screenshot({ path: path.join(output, `cards-${width}.png`) })
      for (const id of width === 390 ? ids : [ids[0]]) {
        assert.ok(artwork[id], id)
        await page.goto(`${base}/cims/${id}`)
        const image = page.locator('.summit-reference img')
        await image.evaluate(element => element.decode())
        assert.ok((await image.getAttribute('src')).endsWith(artwork[id].file))
        assert.match(await page.locator('.summit-reference figcaption').innerText(), /Perfil generado con elevaciones reales/)
        assert.match(await page.locator('.summit-reference figcaption').innerText(), new RegExp(`${artwork[id].bearing}°`))
        const asset = await page.request.get(`${base}/mountains/${artwork[id].file}`)
        assert.equal(asset.status(), 200)
        assert.match(asset.headers()['cache-control'], /max-age=31536000/)
        assert.match(asset.headers()['cache-control'], /immutable/)
        assert.match(asset.headers()['content-type'], /image\/svg\+xml/)
        const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
        assert.ok(size.content <= size.viewport + 1, `${id}: overflow`)
        await page.locator('.summit-reference').screenshot({ path: path.join(output, `${id}-${width}.png`) })
        report.push({ id, width, illustrationLoaded: true, immutableAsset: true, sourceCaption: true, noOverflow: true })
      }
      await page.goto(base + '/fonts#relleu')
      await page.getByRole('heading', { name: 'Ilustraciones del relieve', exact: true }).waitFor()
      assert.match(await page.locator('#relleu').innerText(), /Copernicus/)
      await page.close()
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(terrainRequests, [], 'Terrain APIs must only run in the offline generator')
    const result = { url: base, checks: report, noClientTerrainRequests: true, errors }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
