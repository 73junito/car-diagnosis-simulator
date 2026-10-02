import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const auth = read('auth.js')
const studentSignIn = read('sign-in/student/index.html')
const instructorSignIn = read('sign-in/instructor/index.html')
const studentSignUp = read('sign-up/student/index.html')
const instructorSignUp = read('sign-up/instructor/index.html')
const recoveryPage = read('sign-in/recover/index.html')
const recoveryJs = read('sign-in/recover/recover.js')
const updatePage = read('sign-in/update-password/index.html')
const updateJs = read('sign-in/update-password/update-password.js')
const build = read('scripts/build-static-site.js')

describe('account recovery contract', () => {
  test('exposes password recovery from student and instructor auth pages', () => {
    for (const page of [studentSignIn, instructorSignIn, studentSignUp, instructorSignUp]) {
      expect(page).toContain('href="/sign-in/recover/"')
    }
  })

  test('uses Supabase recover and authenticated password-update endpoints', () => {
    expect(auth).toContain("'/auth/v1/recover'")
    expect(auth).toContain("'/auth/v1/user'")
    expect(auth).toContain("'Authorization': 'Bearer ' + token")
    expect(auth).toContain('window.supabaseRequestPasswordReset')
    expect(auth).toContain('window.supabaseUpdatePassword')
  })
  test('keeps recovery requests privacy preserving', () => {
    expect(recoveryPage).toContain('same confirmation message whether or not an account exists')
    expect(recoveryJs).toContain('If an account exists for that email')
    expect(recoveryJs).toContain('https://app.autolearnpro.com/sign-in/student/')
  })

  test('requires a recovery session before accepting a new password', () => {
    expect(updateJs).toContain("if (!window.getAccessToken?.())")
    expect(updateJs).toContain('recovery session is missing or expired')
    expect(updatePage).toContain('minlength="8"')
    expect(updatePage).toContain('avoid common or easily guessed passwords')
  })

  test('ships recovery pages in the static application build', () => {
    for (const expected of [
      '"sign-in/recover/index.html"',
      '"sign-in/recover/recover.js"',
      '"sign-in/update-password/index.html"',
      '"sign-in/update-password/update-password.js"'
    ]) {
      expect(build).toContain(expected)
    }
  })

  test('maps weak and invalid credentials to actionable user messages', () => {
    expect(auth).toContain("code === 'weak_password'")
    expect(auth).toContain('Choose a stronger password')
    expect(auth).toContain("code === 'invalid_credentials'")
    expect(auth).toContain('reset your password')
  })
})
