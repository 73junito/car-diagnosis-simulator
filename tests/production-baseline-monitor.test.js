const fs = require('fs')
const path = require('path')
const { GATES, REPORT_PATH, runMonitor } = require('../scripts/monitor-production-baseline.js')

describe('Phase 7A production baseline monitor', () => {
  afterEach(() => {
    if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH)
  })

  test('runs the complete release-baseline gate set', () => {
    expect(GATES.map((gate) => gate.id)).toEqual([
      'source-rights-closure',
      'state-privacy-ai-overlays',
      'curriculum-reference-coverage',
      'curriculum-reference-quality',
      'assessment-governance-boundary',
      'production-surfaces',
      'google-crawler-access',
      'public-indexability',
      'production-release-baseline'
    ])
  })

  test('passes quietly when every gate succeeds', () => {
    const report = runMonitor(
      (gate) => ({ status: 0, stdout: `ok ${gate.id}\n`, stderr: '' }),
      (() => {
        const values = [
          new Date('2026-10-10T00:00:00.000Z'),
          new Date('2026-10-10T00:00:01.000Z')
        ]
        return () => values.shift()
      })()
    )

    expect(report).toMatchObject({
      ok: true,
      gates_total: 9,
      gates_passed: 9,
      gates_failed: 0
    })
    expect(fs.existsSync(REPORT_PATH)).toBe(true)
  })

  test('fails the monitor when any release gate fails', () => {
    const report = runMonitor(
      (gate) => ({
        status: gate.id === 'assessment-governance-boundary' ? 1 : 0,
        stdout: '',
        stderr: gate.id === 'assessment-governance-boundary' ? 'boundary regression' : ''
      }),
      (() => {
        const values = [
          new Date('2026-10-10T00:00:00.000Z'),
          new Date('2026-10-10T00:00:01.000Z')
        ]
        return () => values.shift()
      })()
    )

    expect(report.ok).toBe(false)
    expect(report.gates_failed).toBe(1)
    expect(report.results.find((item) => !item.ok)).toMatchObject({
      id: 'assessment-governance-boundary',
      exit_code: 1
    })
  })
})
