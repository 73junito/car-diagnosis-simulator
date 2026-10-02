import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const authSource = fs.readFileSync(path.join(root, 'auth.js'), 'utf8')

describe('account recovery behavior', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
    window.SUPABASE_URL = 'https://example.supabase.co'
    window.SUPABASE_ANON_KEY = 'publishable-test-key'
    delete window.supabaseRequestPasswordReset
    delete window.supabaseUpdatePassword
    delete window.getAuthErrorMessage
    delete window.getAccessToken
    global.fetch = jest.fn()
  })

  test('persists recovery session and records redirect type', () => {
    window.history.replaceState(
      {},
      '',
      '/sign-in/student/#access_token=recovery-token&refresh_token=refresh-token&type=recovery'
    )

    window.eval(authSource)

    expect(localStorage.getItem('supabase_access_token')).toBe('recovery-token')
    expect(localStorage.getItem('supabase_refresh_token')).toBe('refresh-token')
    expect(sessionStorage.getItem('supabase_auth_redirect_type')).toBe('recovery')
    expect(window.location.hash).toBe('')
  })
  test('sends a privacy-preserving recovery request to Supabase', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({})
    })

    window.eval(authSource)
    const result = await window.supabaseRequestPasswordReset(
      'student@example.com',
      'https://app.autolearnpro.com/sign-in/student/'
    )

    expect(result).toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/recover?redirect_to=' +
        encodeURIComponent('https://app.autolearnpro.com/sign-in/student/'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'student@example.com' })
      })
    )
  })

  test('updates password only with an authenticated recovery session', async () => {
    localStorage.setItem('supabase_access_token', 'recovery-token')
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'user-1' })
    })

    window.eval(authSource)
    const result = await window.supabaseUpdatePassword('A-stronger-password-2026!')

    expect(result).toEqual({ id: 'user-1' })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ password: 'A-stronger-password-2026!' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer recovery-token'
        })
      })
    )
  })
  test('turns weak-password and invalid-credential responses into actionable messages', () => {
    window.eval(authSource)

    expect(
      window.getAuthErrorMessage({
        code: 'weak_password',
        message: 'Password is known to be weak and easy to guess.'
      })
    ).toContain('Choose a stronger password')

    expect(
      window.getAuthErrorMessage({
        code: 'invalid_credentials',
        message: 'Invalid login credentials'
      })
    ).toContain('reset your password')
  })

  test('captures expired recovery-link errors and removes them from the URL', () => {
    window.history.replaceState(
      {},
      '',
      '/sign-in/student/#error=access_denied&error_code=otp_expired&error_description=Link%20expired'
    )

    window.eval(authSource)

    const stored = JSON.parse(
      sessionStorage.getItem('supabase_auth_redirect_error')
    )
    expect(stored.code).toBe('otp_expired')
    expect(stored.description).toBe('Link expired')
    expect(window.location.hash).toBe('')
  })
})
