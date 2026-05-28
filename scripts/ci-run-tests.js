const { spawnSync } = require('child_process');

const maxRetries = Number(process.env.CI_TEST_RETRIES || 1);
const backoffMs = Number(process.env.CI_TEST_BACKOFF_MS || 2000);

function runOnce() {
  console.log('Running tests: npm test');
  const res = spawnSync('npm', ['test'], { stdio: 'inherit', shell: true });
  return res.status === 0;
}

(async function main() {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) console.log(`Retry attempt ${attempt} of ${maxRetries}`);
    const ok = runOnce();
    if (ok) {
      console.log('Tests passed');
      process.exit(0);
    }
    if (attempt < maxRetries) {
      const wait = backoffMs * (attempt + 1);
      console.log(`Tests failed — waiting ${wait}ms before retrying`);
      await new Promise(r => setTimeout(r, wait));
    } else {
      console.error('Tests failed after retries');
      process.exit(1);
    }
  }
})();
