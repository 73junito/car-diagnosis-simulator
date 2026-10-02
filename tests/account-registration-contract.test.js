import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const auth = read('auth.js')
const studentSignIn = read('sign-in/student/index.html')
const instructorSignIn = read('sign-in/instructor/index.html')
const instructorSignInJs = read('sign-in/instructor/sign-in.js')
const studentSignUp = read('sign-up/student/index.html')
const studentSignUpJs = read('sign-up/student/sign-up.js')
const instructorSignUp = read('sign-up/instructor/index.html')
const instructorSignUpJs = read('sign-up/instructor/sign-up.js')
const build = read('scripts/build-static-site.js')
const migration = read('supabase/migrations/20261001235500_create_profile_on_auth_signup.sql')
const domainMigration = read('supabase/migrations/20261002001500_add_institution_email_domains.sql')

describe('account registration contract', () => {
  test('exposes account creation from both sign-in pages', () => {
    expect(studentSignIn).toContain('href="/sign-up/student/"')
    expect(studentSignIn).toContain('Create a Student Account')
    expect(instructorSignIn).toContain('href="/sign-up/instructor/"')
    expect(instructorSignIn).toContain('Create an Instructor Account')
  })
  test('uses Supabase password signup and confirmation redirects', () => {
    expect(auth).toContain("'/auth/v1/signup'")
    expect(auth).toContain('redirect_to=')
    expect(auth).toContain('window.supabaseSignUp = supabaseSignUp')
    expect(studentSignUpJs).toContain("account_type: 'student'")
    expect(studentSignUpJs).toContain('https://app.autolearnpro.com/sign-in/student/')
    expect(instructorSignUpJs).toContain("account_type: 'instructor'")
    expect(instructorSignUpJs).toContain('https://app.autolearnpro.com/sign-in/instructor/')
  })

  test('keeps instructor registration separate from authorization', () => {
    expect(instructorSignUp).toContain('does not grant instructor authorization')
    expect(instructorSignUp).toContain('Personal email domains cannot satisfy the instructor-access gate')
    expect(instructorSignUp).toContain('Institution email')
    expect(migration).toContain("values (new.id, new.email, 'student')")
    expect(migration).not.toContain("new.raw_user_meta_data->>'role'")
    expect(migration).not.toContain("'instructor'")
    expect(domainMigration).toContain('create table if not exists public.institution_email_domains')
    expect(domainMigration).toContain('primary key (school_code, domain)')
    expect(domainMigration).toContain('grant all on table public.institution_email_domains to service_role')
  })

  test('supports confirmed sessions and institution verification', () => {
    expect(studentSignUpJs).toContain("window.location.assign('/dashboard/student/')")
    expect(instructorSignUpJs).toContain("window.location.assign('/sign-in/instructor/')")
    expect(instructorSignInJs).toContain("if (token())")
    expect(instructorSignInJs).toContain("schoolStep.classList.remove('hidden')")
  })
  test('ships registration pages in the app static build', () => {
    for (const expected of [
      '"sign-up"',
      '"sign-up/student/index.html"',
      '"sign-up/student/sign-up.js"',
      '"sign-up/instructor/index.html"',
      '"sign-up/instructor/sign-up.js"'
    ]) {
      expect(build).toContain(expected)
    }
  })

  test('allows student personal or institutional email while requiring institutional instructor email', () => {
    expect(studentSignUp).toContain('either a personal or institutional email address')
    expect(instructorSignUp).toContain('institution-issued email address')
    expect(instructorSignUp).toContain('verified email-domain matching')
  })

  test('includes terms and privacy acknowledgement on registration', () => {
    for (const page of [studentSignUp, instructorSignUp]) {
      expect(page).toContain('https://autolearnpro.com/terms')
      expect(page).toContain('https://autolearnpro.com/privacy')
      expect(page).toContain('minlength="8"')
    }
  })
})
