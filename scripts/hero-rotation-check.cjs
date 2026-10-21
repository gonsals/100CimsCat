// Public UI only. Clock control verifies timers without waiting for every cycle.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../data/summits.json')
const artwork = require('../data/mountain-art.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3000'
const output = path.join(__dirname, '../.npm-cache/hero-rotation-check')
const ids = ['pollego-superior-pedraforca', 'puigmal', 'sant-jeroni', 'canigo', 'matagalls', 'puigsacalm']

async function fixture(browser, width, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion })
  await page.addInitScript(() => localStorage.setItem('100cimscat-language', 'es'))
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: route.request().url().includes('/rest/v1/summits') ? catalog : { user: null } }))
  await page.clock.install()
  await page.goto(base)
  await page.locator('.hero-rotator .is-current img').evaluate(image => image.decode())
  await page.getByRole('button', { name: reducedMotion === 'reduce' ? 'Reanudar las imágenes' : 'Pausar las imágenes', exact: true }).waitFor()
  // IntersectionObserver is delivered by rendering, outside the simulated clock.
  await page.waitForTimeout(200)
  await page.clock.pauseAt(Date.now() + 1000)
  await page.clock.runFor(200)
  return page
}

async function current(page, id) {
  await page.waitForFunction(file => document.querySelector('.hero-rotator .is-current img')?.getAttribute('src') === `/mountains/${file}`, artwork[id].file)
  await page.locator('.hero-rotator .is-current img').evaluate(image => image.decode())
  const summit = catalog.find(summit => summit.id === id)
  const caption = await page.locator('.hero-rotator figcaption').innerText()
  assert.ok(caption.includes(id === ids[0] ? 'PEDRAFORCA' : summit.name.toUpperCase()), caption)
  assert.ok(caption.includes(summit.height.toLocaleString('es-ES') + ' m'), caption)
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const report = [], errors = []
  try {
    for (const width of [320, 390, 1280]) {
      const page = await fixture(browser, width)
      page.on('pageerror', error => errors.push(error.message))
      await current(page, ids[0])
      await page.clock.runFor(8100)
      await current(page, ids[1])
      await page.clock.runFor(1100)
      await page.getByRole('button', { name: 'Pausar las imágenes', exact: true }).click()
      await page.mouse.move(0, 0)
      await page.clock.runFor(17000)
      await current(page, ids[1])
      for (let index = 2; index <= 7; index++) {
        await page.getByRole('button', { name: 'Cima siguiente', exact: true }).click()
        await current(page, ids[index % ids.length])
        await page.clock.runFor(1100)
      }
      await page.getByRole('button', { name: 'Cima anterior', exact: true }).click()
      await current(page, ids[0])
      await page.clock.runFor(1100)
      await page.getByRole('button', { name: 'Reanudar las imágenes', exact: true }).click()
      await page.mouse.move(0, 0)
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
      await page.waitForTimeout(100)
      await page.clock.runFor(200)
      await page.clock.runFor(17000)
      await current(page, ids[0])
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.waitForTimeout(100)
      await page.clock.runFor(200)
      await page.clock.runFor(8100)
      await current(page, ids[1])
      await page.clock.runFor(1100)
      await page.getByRole('button', { name: 'Pausar las imágenes', exact: true }).click()
      await page.mouse.move(0, 0)
      // axe schedules its own asynchronous work with browser timers.
      await page.clock.resume()
      const geometry = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, caption: document.querySelector('.hero-rotator figcaption').getBoundingClientRect().right, controls: document.querySelector('.hero-mountain-controls').getBoundingClientRect().left }))
      assert.ok(geometry.content <= geometry.width + 1, JSON.stringify(geometry))
      assert.ok(geometry.caption < geometry.controls, JSON.stringify(geometry))
      if (process.env.AXE_SCRIPT) {
        await page.addScriptTag({ path: process.env.AXE_SCRIPT })
        const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))
        assert.deepEqual(violations, [])
      }
      await page.screenshot({ path: path.join(output, `hero-${width}.png`) })
      report.push({ width, automaticAdvance: true, pauseAndResume: true, manualLoopAndPrevious: true, pausesOffscreen: true, noOverflowOrOverlappingControls: true })
      await page.close()
    }
    const reduced = await fixture(browser, 390, 'reduce')
    await reduced.clock.runFor(25000)
    await current(reduced, ids[0])
    await reduced.getByRole('button', { name: 'Cima siguiente', exact: true }).click()
    await current(reduced, ids[1])
    assert.equal(await reduced.locator('.hero-rotator .is-current').evaluate(element => getComputedStyle(element).animationName), 'none')
    await reduced.close()
    assert.deepEqual(errors, [])
    const result = { url: base, report, reducedMotionDisablesAutoplayAndFade: true, errors }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
