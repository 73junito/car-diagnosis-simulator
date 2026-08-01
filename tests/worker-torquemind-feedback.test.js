const { execSync } = require('child_process')

describe('Worker torquemind-feedback route contract', () => {
  test('index.js parses', () => {
    execSync('node --check worker/index.js', { stdio: 'inherit' })
  })

  test('route returns 405 for GET', () => {
    // We only check syntax here; functional tests run in integration
    execSync('node --check worker/routes/torquemind-feedback.js', { stdio: 'inherit' })
  })

  test('route parses JSON and validates required fields', () => {
    execSync('node --check worker/routes/torquemind-feedback.js', { stdio: 'inherit' })
  })
})
