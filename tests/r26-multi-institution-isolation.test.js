const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve('.')
const matrix = path.join(root, 'tests/r26/isolation-matrix.mjs')

function runMatrix(args) {
  return spawnSync(process.execPath, [matrix, ...args], { encoding: 'utf8', timeout: 180000 })
}

describe('R26 multi-institution isolation (runtime)', () => {
  // These tests execute the real route handler against a local Supabase stub, so
  // they verify authorization behaviour rather than source-code patterns.
  test('institution reporting enforces tenant isolation at runtime', () => {
    const result = runMatrix(['--suite', 'institution'])
    expect(result.stderr).not.toMatch(/HARNESS ERROR/)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('10/10 scenarios passed')
    expect(result.stdout).not.toMatch(/^FAIL/m)
  })

  // The readiness route only exists on feat/instructor-diagnostic-readiness-endpoint.
  // The harness refuses to run the readiness suite without an explicit isolated route
  // rather than silently falling back to a source-code inspection.
  test('readiness suite refuses to run without an isolated worktree route', () => {
    const result = runMatrix(['--suite', 'readiness'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('BLOCKED')
  })
})
