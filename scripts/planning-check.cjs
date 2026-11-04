// Personal accounts, RPC transactions and storage are simulated in the browser.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../data/summits.json')
const base = process.env.CHECK_URL || 'http://127.0.0.1:3101'
const origin = process.env.CHECK_SUPABASE_ORIGIN || 'https://planning-check.supabase.test'
const cookieName = `sb-${new URL(origin).hostname.split('.')[0]}-auth-token`
const output = path.join(__dirname, '../.npm-cache/planning-check')
const userId = '00000000-0000-4000-8000-000000000001'
const user = { id: userId, email: 'planning-check@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const expires = Math.floor(Date.now()/1000)+3600
const session = { access_token: `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: userId, aud: 'authenticated', role: 'authenticated', exp: expires })}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
const csv = '\uFEFFCim;Data;Notes;Preferit\r\nCanigó;2024-01-01;Do not overwrite;No\r\nBalandrau;2024-03-01;"Ruta; ""bonica""\nAmb amics";No\r\nCanigó;2024-04-01;Not selected;Sí\r\nUnknown;2024-01-01;;No\r\nBastiments;2099-01-01;;No\r\nBalandrau;2024-03-01;Duplicate;No\r\nBastiments;;;Sí\r\nCanigó;2025-02-29;;No'
let activePage

async function fixture(browser, width, language = 'es') {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  activePage = page
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
  await page.addInitScript(({ language, session, cookieName }) => {
    localStorage.setItem('100cimscat-language', language)
    document.cookie = `${cookieName}=base64-${btoa(JSON.stringify(session)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}; path=/; SameSite=Lax`
    sessionStorage.setItem('100cimscat-map-v1', 'catalogue-position-preserved')
  }, { language, session, cookieName })
  const state = { lists: [], visits: [], records: [{ summit_id: 'canigo', completed_at: '2024-01-01', notes: 'Original private note', photo_path: `${userId}/canigo/keep.webp` }], favorites: [], saveCalls: [], importCalls: [], failSave: true, loseImportResponse: true }
  await page.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/summit-context?*', route => route.fulfill({ json: { description: {}, photo: null } }))
  await page.route(`${origin}/**`, async route => {
    const request=route.request(), url=new URL(request.url()), method=request.method()
    const json = data => route.fulfill({ json: data })
    const failure = () => route.fulfill({ status: 400, json: { message: 'Intentional fixture failure' } })
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (url.pathname.endsWith('/user')) return json(user)
    if (url.pathname.endsWith('/token')) return json(session)
    if (url.pathname.endsWith('/logout')) return json({})
    if (url.pathname.endsWith('/summits')) return json(catalog)
    if (url.pathname.endsWith('/ascent_records')) return json(state.records)
    if (url.pathname.endsWith('/ascent_visits')) return json(state.visits)
    if (url.pathname.endsWith('/summit_favorites')) return json(state.favorites.map(summit_id => ({ summit_id })))
    if (url.pathname.endsWith('/trip_lists')) {
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`)
      if (method === 'DELETE') { const id=url.searchParams.get('id').slice(3); state.lists=state.lists.filter(list=>list.id!==id); return json([{id}]) }
      return json(state.lists.map(list => ({ ...list, trip_list_summits: list.summitIds.map((summit_id,position)=>({summit_id,position})) })))
    }
    if (url.pathname.endsWith('/rpc/save_trip_list')) {
      const body=request.postDataJSON(); state.saveCalls.push(body)
      assert.equal(body.p_expected_user, userId)
      if (state.failSave) { state.failSave=false; return failure() }
      const list={id:body.p_id,name:body.p_name,planned_on:body.p_planned_on,notes:body.p_notes,summitIds:body.p_summits}
      state.lists=state.lists.filter(row=>row.id!==list.id).concat(list)
      return json(list.id)
    }
    if (url.pathname.endsWith('/rpc/import_journal')) {
      const body=request.postDataJSON(); state.importCalls.push(body)
      assert.equal(body.p_expected_user,userId)
      const result={visits:[],favorites:[],skipped:0}
      for (const row of body.p_rows) {
        if (row.completed_at) {
          if ([...state.records,...state.visits].some(visit=>visit.summit_id===row.summit_id&&visit.completed_at===row.completed_at)) result.skipped++
          else { const visit={...row,id:crypto.randomUUID(),photo_path:null}; state.visits.push(visit);result.visits.push(visit) }
        }
        if (row.favorite&&!state.favorites.includes(row.summit_id)) {state.favorites.push(row.summit_id);result.favorites.push(row.summit_id)}
      }
      if (state.loseImportResponse) { state.loseImportResponse=false;return failure() }
      return json(result)
    }
    if (url.pathname.includes('/storage/v1/object/sign/')&&method==='GET') return route.fulfill({contentType:'image/png',body:png})
    if (url.pathname.includes('/storage/v1/object/sign/')) { const body=request.postDataJSON();return json(body.paths.map(p=>({path:p,signedURL:`/object/sign/summit-photos/${p}?token=fixture` }))) }
    return json([])
  })
  return {context,page,state,errors}
}
async function noOverflow(page) {assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}

async function main() {
  fs.mkdirSync(output,{recursive:true})
  const browser=await chromium.launch({channel:'chrome',headless:true})
  const report=[]
  try {
    for(const width of [320,390,1280]) {
      const {context,page,state,errors}=await fixture(browser,width)
      await page.goto(base)
      await page.getByRole('heading',{name:'Próximas salidas',exact:true}).waitFor()
      await page.getByRole('button',{name:'Nueva lista',exact:true}).click()
      let dialog=page.locator('.feature-dialog')
      await dialog.getByLabel('Nombre de la lista',{exact:true}).fill('Pirineo verano')
      await dialog.getByLabel('Fecha prevista (opcional)',{exact:true}).fill('2027-06-01')
      await dialog.getByLabel('Notas de la salida',{exact:true}).fill('Una salida privada\nCon amigos')
      for(const id of ['canigo','balandrau']) {
        await dialog.getByLabel('Buscar cimas para añadir',{exact:true}).fill(id)
        await dialog.getByLabel('Cima para añadir',{exact:true}).selectOption(id)
        await dialog.getByRole('button',{name:'Añadir cima',exact:true}).click()
      }
      await dialog.getByRole('button',{name:'Subir posición: Balandrau',exact:true}).click()
      assert.ok((await dialog.locator('.trip-summits li').first().innerText()).includes('Balandrau'))
      await dialog.screenshot({path:path.join(output,`trip-editor-${width}.png`)})
      await dialog.getByRole('button',{name:'Guardar',exact:true}).click()
      await dialog.getByRole('alert').waitFor()
      assert.equal(await dialog.getByLabel('Notas de la salida',{exact:true}).inputValue(),'Una salida privada\nCon amigos')
      await dialog.getByRole('button',{name:'Guardar',exact:true}).click()
      await dialog.waitFor({state:'detached'})
      assert.equal(state.lists.length,1);assert.equal(state.saveCalls[0].p_id,state.saveCalls[1].p_id)
      assert.deepEqual(state.lists[0].summitIds,['balandrau','canigo'])
      await page.reload()
      await page.getByRole('heading',{name:'Pirineo verano',exact:true}).waitFor()
      await page.getByRole('button',{name:'Editar lista',exact:true}).click()
      dialog=page.locator('.feature-dialog')
      await dialog.getByLabel('Nombre de la lista',{exact:true}).fill('Discard this')
      await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
      await dialog.getByRole('button',{name:'Continuar editando',exact:true}).click()
      assert.equal(await dialog.getByLabel('Nombre de la lista',{exact:true}).inputValue(),'Discard this')
      await page.keyboard.press('Escape')
      await dialog.getByRole('button',{name:'Descartar cambios',exact:true}).click()
      await dialog.waitFor({state:'detached'})
      assert.equal(state.lists[0].name,'Pirineo verano')
      await page.getByRole('button',{name:'Ver mapa de la lista',exact:true}).click()
      await page.locator('.trip-planner .leaflet-container').waitFor()
      await page.locator('.trip-planner path.leaflet-interactive,.trip-planner .summit-cluster-icon').first().waitFor()
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('100cimscat-map-v1')),'catalogue-position-preserved')
      await noOverflow(page)
      await page.locator('.trip-planner').screenshot({path:path.join(output,`trip-list-${width}.png`)})

      await page.locator('.journal-tools > summary').click()
      await page.getByRole('button',{name:'Importar CSV',exact:true}).click()
      dialog=page.locator('.feature-dialog')
      await dialog.getByLabel('Archivo CSV',{exact:true}).setInputFiles({name:'visits.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
      await dialog.getByRole('button',{name:'Importar CSV (3)',exact:true}).waitFor()
      assert.equal(state.importCalls.length,0)
      assert.ok(await dialog.getByLabel('Seleccionar fila 2',{exact:true}).isDisabled())
      assert.ok(await dialog.getByLabel('Seleccionar fila 5',{exact:true}).isDisabled())
      await dialog.getByLabel('Seleccionar fila 4',{exact:true}).uncheck()
      await dialog.screenshot({path:path.join(output,`import-preview-${width}.png`)})
      await dialog.getByRole('button',{name:'Importar CSV (2)',exact:true}).click()
      await dialog.getByRole('alert').waitFor()
      assert.equal(state.visits.length,1)
      await dialog.getByRole('button',{name:'Importar CSV (2)',exact:true}).click()
      await dialog.getByRole('heading',{name:'Importación completada',exact:true}).waitFor()
      assert.equal(state.importCalls.length,2);assert.equal(state.visits.length,1)
      assert.equal(state.visits[0].notes,'Ruta; "bonica"\nAmb amics')
      assert.equal(state.records[0].notes,'Original private note');assert.ok(state.records[0].photo_path.endsWith('keep.webp'))
      assert.deepEqual(state.favorites,['bastiments'])
      assert.ok(state.importCalls.every(call=>call.p_rows.length===2))
      await dialog.getByRole('button',{name:'Cerrar',exact:true}).last().click()
      await page.getByRole('button',{name:/Editar ascensión: Balandrau,/}).waitFor()
      await page.getByRole('button',{name:'Eliminar lista',exact:true}).click()
      await page.getByRole('button',{name:'Sí, eliminar lista',exact:true}).click()
      await page.getByText('Todavía no tienes listas.',{exact:true}).waitFor()
      assert.equal(state.lists.length,0);assert.equal(state.visits.length,1);assert.equal(state.records.length,1)
      await noOverflow(page);assert.deepEqual(errors,[])
      report.push({width,lists:true,stableRetry:true,reordering:true,map:true,draftProtection:true,csvPreview:true,selection:true,retryAfterLostResponse:true,preservedNotesPhotos:true,errors})
      await context.close()
    }
    for(const [language,heading,button] of [['ca','Pròximes sortides','Nova llista'],['en','Upcoming trips','New list']]) {
      const {context,page,errors}=await fixture(browser,390,language)
      await page.goto(base);await page.getByRole('heading',{name:heading,exact:true}).waitFor()
      await page.getByRole('button',{name:button,exact:true}).click();await page.locator('.feature-dialog').waitFor()
      await noOverflow(page);assert.deepEqual(errors,[]);await context.close();report.push({language,translated:true})
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({report,output},null,2))
  } catch(error) {
    if(activePage&&!activePage.isClosed()) {
      await activePage.screenshot({path:path.join(output,'failure.png'),fullPage:true})
      fs.writeFileSync(path.join(output,'failure.txt'),await activePage.locator('body').innerText())
    }
    throw error
  } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
