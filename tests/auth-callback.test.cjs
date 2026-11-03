const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { NextRequest } = require('next/server')

const source = fs.readFileSync(path.join(__dirname, '../app/auth/callback/route.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function callback(error = null) {
  const exports = {}
  const codes = []
  vm.runInNewContext(compiled, { exports, URL, require: name => {
    if (name === 'next/server') return require('next/server')
    assert.equal(name, '@/lib/supabase/server')
    return { createClient: async () => ({ auth: { exchangeCodeForSession: async code => { codes.push(code); return { error } } } }) }
  } })
  return { get: exports.GET, codes }
}

function request(next, code = 'test-code') {
  const url = new URL('https://100cims.example/auth/callback')
  if (code !== null) url.searchParams.set('code', code)
  if (next !== undefined) url.searchParams.set('next', next)
  return new NextRequest(url)
}

test('successful sign-in preserves internal paths, query strings and fragments', async () => {
  const { get, codes } = callback()
  for (const next of [undefined, '/', '/cims/canigo', '/?cim=canigo#cims', '/cims/../#quadern']) {
    const response = await get(request(next))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), new URL(next ?? '/', 'https://100cims.example').href)
  }
  assert.equal(codes.length, 5)
  assert.ok(codes.every(code => code === 'test-code'))
})

test('successful sign-in rejects external, relative and disguised redirect targets', async () => {
  const { get } = callback()
  const unsafe = [
    'https://evil.invalid/path', '//evil.invalid/path', '///evil.invalid',
    '/\\evil.invalid', '\\evil.invalid', '/\t/evil.invalid', '/\n/evil.invalid',
    '/\r/evil.invalid', 'javascript:alert(1)', 'https://100cims.example@evil.invalid',
    'https://100cims.example/cims/canigo', 'cims/canigo', '', '//[invalid',
  ]
  for (const next of unsafe) {
    const response = await get(request(next))
    assert.equal(response.headers.get('location'), 'https://100cims.example/', JSON.stringify(next))
  }
})

test('a missing or rejected sign-in code returns the existing error destination', async () => {
  const missing = callback()
  assert.equal((await missing.get(request('//evil.invalid', null))).headers.get('location'), 'https://100cims.example/?auth=error')
  assert.equal(missing.codes.length, 0)
  const rejected = callback({ message: 'Invalid code' })
  assert.equal((await rejected.get(request('/cims/canigo'))).headers.get('location'), 'https://100cims.example/?auth=error')
})
