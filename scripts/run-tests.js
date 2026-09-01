const fs = require('fs');
const { spawnSync } = require('child_process');

if (fs.existsSync('scripts/guard-no-nock.js')) {
  const guard = spawnSync(process.execPath, ['scripts/guard-no-nock.js'], {
    stdio: 'inherit'
  });
  if (guard.status !== 0) process.exit(guard.status);
} else {
  console.log('guard-no-nock.js not found, skipping');
}

const jest = spawnSync(
  process.execPath,
  [
    '-r',
    './tests/jest-undici-register.js',
    './node_modules/jest/bin/jest.js',
    '--config=jest.config.js',
    '--ci',
    '--reporters=default',
    '--runInBand'
  ],
  { stdio: 'inherit' }
);

if (jest.status !== 0) {
  console.error('\n❌ Jest tests failed');
  process.exit(jest.status ?? 1);
}

console.log('\n✅ Jest tests passed. Running Supabase contract tests...');

const supabase = spawnSync(
  process.execPath,
  [
    '--test',
    'supabase/tests/security-contracts.test.js',
    'supabase/tests/package-integrity.test.js'
  ],
  { stdio: 'inherit' }
);

if (supabase.status !== 0) {
  console.error('\n❌ Supabase contract tests failed');
  process.exit(supabase.status ?? 1);
}

console.log('\n✅ All tests passed (Jest + Supabase contracts)');
process.exit(0);
