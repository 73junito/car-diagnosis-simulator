/* global jest */
// Setup file executed by Jest in each worker before tests run.
// Configures per-test retries based on the `CI_PER_TEST_RETRIES` env var.
const retries = Number(process.env.CI_PER_TEST_RETRIES || process.env.PER_TEST_RETRIES || 0);
if (retries > 0) {
  // `jest.retryTimes` is provided by jest-circus runner in the setup environment.
  // eslint-disable-next-line no-undef
  if (typeof jest !== 'undefined' && typeof jest.retryTimes === 'function') {
    // Set global retry count for all tests in this worker
    jest.retryTimes(retries);
    // eslint-disable-next-line no-console
    console.log(`Per-test retry configured: ${retries}`);
  } else {
    // eslint-disable-next-line no-console
    console.log('jest.retryTimes not available — ensure jest-circus is installed and testRunner is configured.');
  }
} else {
  // eslint-disable-next-line no-console
  console.log('Per-test retries disabled (CI_PER_TEST_RETRIES not set or 0).');
}
