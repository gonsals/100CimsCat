const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.join(__dirname, '../public/offline.js'), 'utf8')
const key = '100cimscat-offline-v1'
const catalog = require('../data/summits.json')
const summit = id => ({ ...catalog.find(item => item.id === id), savedAt: '2026-01-01T12:00:00Z' })

function reader(items, pathname = '/offline.html') {
  class Element {
    children = []
    textContent = ''
    className = ''
    listeners = {}
    constructor(tag) { this.tag = tag }
    append(...nodes) { this.children.push(...nodes) }
    replaceChildren(...nodes) { this.children = nodes }
    addEventListener(name, handler) { this.listeners[name] = handler }
  }
  const nodes = new Map()
  const storage = new Map([[key, JSON.stringify(items)]])
  const listeners = {}
  const document = {
    documentElement: {},
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element('div')); return nodes.get(id) },
    createElement(tag) { return new Element(tag) },
  }
  vm.runInNewContext(source, {
    document, URL, URLSearchParams, location: new URL(pathname, 'https://100cims.example'),
    localStorage: { getItem: name => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, value) },
    window: { addEventListener: (name, handler) => { listeners[name] = handler } },
  })
  return {
    cards: () => nodes.get('summits').children,
    status: nodes.get('status'),
    store: items => storage.set(key, JSON.stringify(items)),
    corrupt: () => storage.set(key, '{broken'),
    saved: () => JSON.parse(storage.get(key)),
    dispatch: (name, event = {}) => listeners[name](event),
  }
}

test('offline reader survives malformed URL escapes and still reports a missing summit', () => {
  const page = reader([summit('canigo')], '/cims/%E0%A4%A')
  assert.equal(page.cards().length, 0)
  assert.equal(page.status.textContent, 'Aquesta cima no està descarregada.')
  const saved = reader([summit('canigo')], '/cims/%63anigo')
  assert.equal(saved.cards().length, 1)
  assert.equal(saved.cards()[0].children[0].textContent, 'Canigó')
})

test('removing a download uses current storage and preserves changes from another tab', () => {
  const page = reader([summit('canigo'), summit('balandrau')])
  const remove = page.cards()[0].children.at(-1).children.find(node => node.tag === 'button')
  // Another tab removes Balandrau and adds Pedraforca before its storage event is handled.
  page.store([summit('canigo'), summit('pollego-superior-pedraforca')])
  remove.listeners.click()
  assert.deepEqual(page.saved().map(item => item.id), ['pollego-superior-pedraforca'])
  assert.equal(page.cards().length, 1)
})

test('offline downloads refresh after storage changes, clearing storage and restoring a page', () => {
  const page = reader([summit('canigo')])
  page.store([summit('canigo'), summit('balandrau')])
  page.dispatch('storage', { key })
  assert.equal(page.cards().length, 2)
  page.store([])
  page.dispatch('storage', { key: null })
  assert.equal(page.cards().length, 0)
  page.store([summit('balandrau')])
  page.dispatch('pageshow')
  assert.equal(page.cards().length, 1)
})

test('offline reader recovers from corrupt storage without retaining an error state', () => {
  const page = reader([])
  page.corrupt()
  page.dispatch('storage', { key })
  assert.equal(page.status.className, 'error')
  page.store([summit('canigo')])
  page.dispatch('storage', { key })
  assert.equal(page.status.className, '')
  assert.equal(page.status.textContent, '')
  assert.equal(page.cards().length, 1)
})
