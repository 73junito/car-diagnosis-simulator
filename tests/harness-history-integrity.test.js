const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve('.')
const guard = path.join(root, 'scripts/verify-harness-history-integrity.js')

const HEADER =
  'accepted,denied,acceptRate,completed,avgDuration,p50,p90,p99,notificationAttempts,totalLogs,generatedAt,source'

const OCT_24 = '2026-10-24T06:08:07.514Z'
const OCT_27 = '2026-10-27T06:08:51.834Z'
const OCT_28 = '2026-10-28T06:07:03.286Z'

function historyRow(timestamp, overrides = {}) {
  const base = {
    accepted: 50,
    denied: 0,
    acceptRate: '1.00',
    completed: 50,
    avgDuration: 371,
    p50: 261,
    p90: 303,
    p99: 1992,
    notificationAttempts: 0,
    totalLogs: 0
  }
  const merged = { ...base, ...overrides }
  return [
    merged.accepted,
    merged.denied,
    merged.acceptRate,
    merged.completed,
    merged.avgDuration,
    merged.p50,
    merged.p90,
    merged.p99,
    merged.notificationAttempts,
    merged.totalLogs,
    timestamp,
    'run-scheduled-summary.json'
  ].join(',')
}

function writeCsv(dir, name, rows, header = HEADER) {
  const file = path.join(dir, name)
  fs.writeFileSync(file, [header, ...rows].join('\n') + '\n')
  return file
}

function runGuard(args) {
  return spawnSync(process.execPath, [guard, ...args], { encoding: 'utf8' })
}

describe('scheduled harness history integrity guard', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-integrity-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('accepts a strictly ascending file with unique records', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_27), historyRow(OCT_28)])
    const result = runGuard(['--file', file])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('PASS:')
  })

  test('accepts a chronological append', () => {
    const baseline = writeCsv(dir, 'baseline.csv', [historyRow(OCT_24), historyRow(OCT_27)])
    const proposed = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_27), historyRow(OCT_28)])
    const result = runGuard(['--file', proposed, '--baseline-file', baseline])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('baseline records preserved: 2')
  })

  test('accepts a chronological backfill, the shape of the PR #1140 correction', () => {
    const baseline = writeCsv(dir, 'baseline.csv', [historyRow(OCT_24), historyRow(OCT_28)])
    const proposed = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_27), historyRow(OCT_28)])
    const result = runGuard(['--file', proposed, '--baseline-file', baseline])
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })

  test('rejects deleting a historical record, the PR #1140 regression', () => {
    const baseline = writeCsv(dir, 'baseline.csv', [historyRow(OCT_24), historyRow(OCT_28)])
    const proposed = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_27)])
    const result = runGuard(['--file', proposed, '--baseline-file', baseline])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`would delete historical record ${OCT_28}`)
  })

  test('rejects rewriting a historical record in place', () => {
    const baseline = writeCsv(dir, 'baseline.csv', [historyRow(OCT_24), historyRow(OCT_28)])
    const proposed = writeCsv(dir, 'history.csv', [
      historyRow(OCT_24),
      historyRow(OCT_28, { avgDuration: 999 })
    ])
    const result = runGuard(['--file', proposed, '--baseline-file', baseline])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`would rewrite historical record ${OCT_28}`)
  })

  test('rejects duplicate generatedAt values', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_27), historyRow(OCT_27)])
    const result = runGuard(['--file', file])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`duplicate generatedAt ${OCT_27}`)
  })

  test('rejects records that are not strictly ascending', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow(OCT_28), historyRow(OCT_24)])
    const result = runGuard(['--file', file])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not strictly ascending')
  })

  test('rejects reordering of existing historical records', () => {
    const baseline = writeCsv(dir, 'baseline.csv', [historyRow(OCT_24), historyRow(OCT_27), historyRow(OCT_28)])
    const proposed = writeCsv(dir, 'history.csv', [historyRow(OCT_24), historyRow(OCT_28), historyRow(OCT_27)])
    const result = runGuard(['--file', proposed, '--baseline-file', baseline])
    expect(result.status).toBe(1)
  })

  test('rejects rows with the wrong field count', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow(OCT_24), '50,0,1.00'])
    const result = runGuard(['--file', file])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('expected 12')
  })

  test('rejects an unparseable generatedAt', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow('not-a-timestamp')])
    const result = runGuard(['--file', file])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('unparseable generatedAt')
  })

  test('rejects a header that does not match the canonical columns', () => {
    const file = writeCsv(dir, 'history.csv', [historyRow(OCT_24)], 'accepted,generatedAt')
    const result = runGuard(['--file', file])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('canonical column order')
  })

  test('exits 2 when the history file is missing', () => {
    const result = runGuard(['--file', path.join(dir, 'absent.csv')])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('unable to read')
  })

  test('CI enforces the guard against the base branch on pull requests', () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
    expect(workflow).toContain('Enforce scheduled harness history integrity')
    expect(workflow).toContain('github.base_ref')
    expect(workflow).toContain('--baseline-ref FETCH_HEAD')
  })

  test('the guard is exposed as an npm validate script', () => {
    const scripts = require(path.join(root, 'package.json')).scripts
    expect(scripts['validate:harness-history']).toBe('node scripts/verify-harness-history-integrity.js')
  })
})
