const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve('.')
const writer = path.join(root, 'scripts/append-harness-history.js')
const guard = path.join(root, 'scripts/verify-harness-history-integrity.js')

const HEADER =
  'accepted,denied,acceptRate,completed,avgDuration,p50,p90,p99,notificationAttempts,totalLogs,generatedAt,source'

const OCT_26 = '2026-10-26T06:10:47.544Z'
const OCT_27 = '2026-10-27T06:08:51.834Z'
const OCT_28 = '2026-10-28T06:07:03.286Z'
const OCT_29 = '2026-10-29T06:07:00.000Z'

function historyRow(generatedAt, avgDuration = 371) {
  return [50, 0, '1.00', 50, avgDuration, 261, 303, 1992, 0, 0, generatedAt, 'run-scheduled-summary.json'].join(',')
}

function summaryFile(dir, name = 'summary.json') {
  const file = path.join(dir, name)
  fs.writeFileSync(file, JSON.stringify({ results: [{ ok: true, latency: 10 }, { ok: true, latency: 20 }] }))
  return file
}

function fileWithRaw(dir, rows, header = HEADER) {
  const file = path.join(dir, 'raw-history.csv')
  fs.writeFileSync(file, [header, ...rows].join('\n') + '\n')
  return file
}

function readRows(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1)
}

function runWriter(args) {
  return spawnSync(process.execPath, [writer, ...args], { encoding: 'utf8' })
}

describe('append-harness-history insertion safety', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-writer-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('appends a newer run at the end without touching existing records', () => {
    const history = fileWithRaw(dir, [historyRow(OCT_27), historyRow(OCT_28)])
    const before = readRows(history)
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_29])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('INSERTED_AT:2')
    const after = readRows(history)
    expect(after).toHaveLength(3)
    expect(after.slice(0, 2)).toEqual(before)
    expect(after[2]).toContain(OCT_29)
  })

  // The exact PR #1135 shape: main already holds Oct 27 and Oct 28 while the run
  // being recorded is Oct 26. It must be backfilled, not rejected, not appended last.
  test('backfills an older run into its chronological position', () => {
    const oct24 = historyRow('2026-10-24T06:08:07.514Z', 284)
    const history = fileWithRaw(dir, [oct24, historyRow(OCT_27), historyRow(OCT_28)])
    const before = readRows(history)
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_26])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('INSERTED_AT:1')
    const after = readRows(history)
    expect(after.map((row) => row.split(',')[10])).toEqual([
      '2026-10-24T06:08:07.514Z',
      OCT_26,
      OCT_27,
      OCT_28
    ])
    // Every pre-existing record survives byte-for-byte, in its original order.
    expect(after.filter((row) => !row.includes(OCT_26))).toEqual(before)
  })

  test('refuses a duplicate timestamp and leaves the file untouched', () => {
    const history = fileWithRaw(dir, [historyRow(OCT_27), historyRow(OCT_28)])
    const before = fs.readFileSync(history, 'utf8')
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_27])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Refusing to append duplicate generatedAt')
    expect(fs.readFileSync(history, 'utf8')).toBe(before)
  })

  test('refuses an out-of-order history instead of extending it', () => {
    const history = fileWithRaw(dir, [historyRow(OCT_28), historyRow(OCT_27)])
    const before = fs.readFileSync(history, 'utf8')
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_29])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not strictly ascending')
    expect(fs.readFileSync(history, 'utf8')).toBe(before)
  })

  test('refuses a malformed existing row instead of extending it', () => {
    const history = fileWithRaw(dir, [historyRow(OCT_27), '50,0,1.00'])
    const before = fs.readFileSync(history, 'utf8')
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_29])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('expected 12')
    expect(fs.readFileSync(history, 'utf8')).toBe(before)
  })

  test('refuses a header that does not match the canonical columns', () => {
    const history = fileWithRaw(dir, [historyRow(OCT_27)], 'accepted,generatedAt')
    const before = fs.readFileSync(history, 'utf8')
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_29])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('canonical columns')
    expect(fs.readFileSync(history, 'utf8')).toBe(before)
  })

  test('creates the header when the history file does not exist', () => {
    const history = path.join(dir, 'fresh.csv')
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_26])

    expect(result.status).toBe(0)
    const rows = readRows(history)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain(OCT_26)
  })

  test('defaults to the write time and keeps the APPENDED contract', () => {
    const history = fileWithRaw(dir, [historyRow('2020-01-01T00:00:00.000Z')])
    const result = runWriter([summaryFile(dir), history])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('APPENDED:2,0,1.00,2,15')
    expect(readRows(history)).toHaveLength(2)
  })

  test('produces a file the independent guard accepts', () => {
    const oct24 = historyRow('2026-10-24T06:08:07.514Z', 284)
    const history = fileWithRaw(dir, [oct24, historyRow(OCT_27), historyRow(OCT_28)])
    const result = runWriter([summaryFile(dir), history, '--generated-at', OCT_26])
    expect(result.status).toBe(0)

    const guardResult = spawnSync(process.execPath, [guard, '--file', history], { encoding: 'utf8' })
    expect(guardResult.status).toBe(0)
    expect(guardResult.stdout).toContain('PASS:')
  })
})
