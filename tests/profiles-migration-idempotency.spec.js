const fs = require('fs');
const path = require('path');

describe('profiles migration idempotency', () => {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '..', 'supabase', 'migrations', '20260918203224_profiles.sql'),
    'utf8'
  ).toLowerCase();

  test('does not fail when public.profiles already exists', () => {
    expect(sql).toContain('create table if not exists public.profiles');
    expect(sql).toContain('add column if not exists email');
    expect(sql).toContain('add column if not exists role');
    expect(sql).toContain('add column if not exists created_at');
  });

  test('does not duplicate the existing own-profile policy', () => {
    expect(sql).toContain('from pg_policies');
    expect(sql).toContain("policyname = 'users can read their own profile'");
    expect(sql).toContain('if not exists');
  });

  test('retains least-privilege profile grants', () => {
    expect(sql).toContain('revoke all on table public.profiles from anon');
    expect(sql).toContain('revoke all on table public.profiles from authenticated');
    expect(sql).toContain('grant select on table public.profiles to authenticated');
    expect(sql).toContain('enable row level security');
  });
});
