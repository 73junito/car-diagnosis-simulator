const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261012031851_harden_trigger_function_execution.sql'), 'utf8')
const profileMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261001235500_create_profile_on_auth_signup.sql'), 'utf8')
const claimMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261002004500_add_student_institution_claims.sql'), 'utf8')
const externalMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260710204828_external_data_resource_registry.sql'), 'utf8')

describe('Supabase trigger-function hardening', () => {
  test('pins an empty search path on all three helper functions', () => {
    for (const fn of [
      'public.handle_new_auth_user()',
      'public.capture_student_institution_claim()',
      'public.set_external_data_resource_updated_at()'
    ]) {
      expect(migration).toContain(`alter function ${fn}`)
    }
    expect((migration.match(/set search_path = '';/g) || [])).toHaveLength(3)
  })

  test('removes direct PUBLIC, anon, and authenticated execution', () => {
    for (const fn of [
      'public.handle_new_auth_user()',
      'public.capture_student_institution_claim()',
      'public.set_external_data_resource_updated_at()'
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn} from public, anon, authenticated;`)
    }
  })

  test('security-definer trigger bodies schema-qualify application relations', () => {
    expect(profileMigration).toContain('insert into public.profiles')
    expect(claimMigration).toContain('from public.institutions i')
    expect(claimMigration).toContain('insert into public.student_institution_claims')
  })

  test('required trigger wiring remains defined', () => {
    expect(profileMigration).toContain('for each row execute function public.handle_new_auth_user()')
    expect(claimMigration).toContain('for each row execute function public.capture_student_institution_claim()')
    expect(externalMigration).toContain('execute function public.set_external_data_resource_updated_at()')
  })
})
