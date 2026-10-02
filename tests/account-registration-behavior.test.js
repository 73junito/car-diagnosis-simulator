import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const authSource = fs.readFileSync(path.join(root, 'auth.js'), 'utf8')
const instructorSource = fs.readFileSync(
  path.join(root, 'sign-in/instructor/sign-in.js'),
  'utf8'
)

function jwtWithEmail(email) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ email })}.sig`
}

describe('account registration behavior', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
    delete window.supabaseSignIn
    delete window.supabaseSignUp
    delete window.supabaseSignOut
    delete window.getAccessToken
    delete window.consumeAuthRedirect
    global.fetch = jest.fn()
  })

  test('consumes email-confirmation fragment, persists session, and scrubs tokens from the URL', () => {
    const accessToken = jwtWithEmail('student@example.edu')
    window.history.replaceState(
      {},
      '',
      '/sign-in/student/#access_token=' +
        encodeURIComponent(accessToken) +
        '&refresh_token=refresh-123&type=signup'
    )

    window.eval(authSource)

    expect(localStorage.getItem('supabase_access_token')).toBe(accessToken)
    expect(localStorage.getItem('supabase_refresh_token')).toBe('refresh-123')
    expect(localStorage.getItem('supabase_user_email')).toBe('student@example.edu')
    expect(window.location.pathname).toBe('/sign-in/student/')
    expect(window.location.hash).toBe('')
    expect(window.getAccessToken()).toBe(accessToken)
  })
  test('expired instructor session returns to credentials instead of exposing institution verification', async () => {
    document.body.innerHTML = `
      <div id="credentialStep" class="hidden">
        <form id="instructorSignIn">
          <input name="email" />
          <input name="password" />
          <button id="signInButton" type="submit">Continue</button>
        </form>
      </div>
      <div id="schoolStep" class="hidden">
        <form id="schoolLookup">
          <input name="schoolCode" />
        </form>
        <div id="institutionResult" class="institution-card hidden"></div>
      </div>
      <div id="status" class="status hidden"></div>
    `

    window.getAccessToken = jest.fn(() => 'expired-token')
    window.supabaseSignOut = jest.fn()
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: 'Authentication required' })
    })

    window.eval(instructorSource)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.supabaseSignOut).toHaveBeenCalledTimes(1)
    expect(document.getElementById('credentialStep').classList.contains('hidden')).toBe(false)
    expect(document.getElementById('schoolStep').classList.contains('hidden')).toBe(true)
    expect(document.getElementById('status').textContent).toContain('session expired')
  })
})
