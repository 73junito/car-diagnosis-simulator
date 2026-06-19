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

process.exit(jest.status ?? 1);
