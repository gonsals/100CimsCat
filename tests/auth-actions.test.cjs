const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Exercise the actual event handlers with rejected SDK promises as well as API
// errors. Transport-only mocks cannot reproduce every unexpected SDK exception.
const filename = path.join(__dirname, '../components/CimTracker.tsx')
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = ['sendMagicLink', 'signInWithGoogle', 'signOut']
const functions = new Map()
function collect(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.set(node.name.text, node.getText(source))
  ts.forEachChild(node, collect)
}
collect(source)
assert.equal(functions.size, names.length, 'All authentication event handlers must be covered')
const compiled = ts.transpileModule([...functions.values()].join('\n') + '\n' + names.map(name => `exports.${name} = ${name}`).join('\n'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText

function fixture(action, response) {
  const calls = []
  const state = {
    sendingLink: false, signingInWithGoogle: false, signingOut: false,
    emailError: '', googleError: '', notice: '', authOpen: true, profileOpen: true, user: { id: 'fixture-user' },
  }
  const context = {
    ...state, exports: {}, email: 'fixture@example.invalid', t: value => value,
    getAuthCallbackUrl: () => 'https://100cims.example/auth/callback',
    supabase: { auth: Object.fromEntries(['signInWithOtp', 'signInWithOAuth', 'signOut'].map(method => [method, async args => {
      calls.push({ method, args })
      return response()
    }])) },
  }
  context.supabase.auth.getSession = async () => ({ data: { session: { user: state.user } }, error: null })
  for (const key of Object.keys(state)) context[`set${key[0].toUpperCase()}${key.slice(1)}`] = value => { state[key] = context[key] = value }
  vm.runInNewContext(compiled, context)
  return {
    state, calls, context,
    run: () => context.exports[action]({ preventDefault() {} }),
  }
}

const actions = [
  { name: 'sendMagicLink', method: 'signInWithOtp', pending: 'sendingLink', failure: 'emailError' },
  { name: 'signInWithGoogle', method: 'signInWithOAuth', pending: 'signingInWithGoogle', failure: 'googleError' },
  { name: 'signOut', method: 'signOut', pending: 'signingOut', failure: 'notice' },
]

for (const action of actions) {
  for (const mode of ['API error', 'unexpected exception']) {
    test(`${action.name} recovers from ${mode} and permits a successful retry`, async () => {
      let failing = true
      const page = fixture(action.name, () => {
        if (!failing) return { error: null }
        if (mode === 'unexpected exception') throw new Error('Private implementation detail')
        return { error: { message: 'Private implementation detail' } }
      })
      await page.run()
      assert.equal(page.state[action.pending], false)
      assert.ok(page.state[action.failure])
      assert.ok(!page.state[action.failure].includes('Private implementation detail'))
      assert.equal(action.name === 'signOut' ? page.state.profileOpen : page.state.authOpen, true)
      failing = false
      await page.run()
      assert.equal(page.calls.length, 2)
      assert.ok(page.calls.every(call => call.method === action.method))
      assert.equal(page.state[action.pending], false)
      if (action.name === 'sendMagicLink') {
        assert.equal(page.state.authOpen, false)
        assert.equal(page.state.emailError, '')
        assert.equal(page.calls[1].args.email, 'fixture@example.invalid')
        assert.equal(page.calls[1].args.options.emailRedirectTo, 'https://100cims.example/auth/callback')
      } else if (action.name === 'signInWithGoogle') {
        assert.equal(page.state.googleError, '')
        assert.equal(page.calls[1].args.provider, 'google')
        assert.equal(page.calls[1].args.options.redirectTo, 'https://100cims.example/auth/callback')
      } else {
        assert.equal(page.state.profileOpen, false)
        assert.equal(page.state.notice, 'Has tancat la sessió.')
      }
    })
  }

  test(`${action.name} ignores duplicate submissions while its request is pending`, async () => {
    let finish
    const response = new Promise(resolve => { finish = resolve })
    const page = fixture(action.name, () => response)
    const pending = page.run()
    assert.equal(page.state[action.pending], true)
    await page.run()
    if (action.name !== 'signOut') {
      const other = action.name === 'sendMagicLink' ? 'signInWithGoogle' : 'sendMagicLink'
      await page.context.exports[other]({ preventDefault() {} })
    }
    assert.equal(page.calls.length, 1)
    finish({ error: null })
    await pending
    assert.equal(page.state[action.pending], false)
  })
}

test('authentication actions tolerate missing configuration without becoming busy', async () => {
  for (const action of actions) {
    const page = fixture(action.name, () => { throw new Error('Must not be called') })
    page.context.supabase = null
    await page.run()
    assert.equal(page.calls.length, 0)
    assert.equal(page.state[action.pending], false)
  }
})

test('sign-out reports a remote revocation failure after the SDK removes the local session', async () => {
  const page = fixture('signOut', () => ({ error: { message: 'Remote revocation failed' } }))
  page.context.supabase.auth.getSession = async () => ({ data: { session: null }, error: null })
  await page.run()
  assert.equal(page.state.signingOut, false)
  assert.equal(page.state.profileOpen, false)
  assert.equal(page.state.user, null)
  assert.equal(page.state.notice, 'Has tancat la sessió en aquest dispositiu. No hem pogut confirmar la sortida dels altres dispositius.')
})

test('sign-out remains recoverable if checking the local session also throws', async () => {
  const page = fixture('signOut', () => { throw new Error('Fixture') })
  page.context.supabase.auth.getSession = async () => { throw new Error('Session check failed') }
  await page.run()
  assert.equal(page.state.signingOut, false)
  assert.equal(page.state.profileOpen, true)
  assert.ok(page.state.user)
  assert.equal(page.state.notice, 'No s’ha pogut tancar la sessió. Torna-ho a provar.')
})
