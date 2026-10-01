import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const root = path.resolve('.')
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/scheduled-harness.yml'),
  'utf8'
)
const harness = fs.readFileSync(path.join(root, 'scripts/harness.js'), 'utf8')
const appendScript = path.join(root, 'scripts/append-harness-history.js')

describe('scheduled harness workflow contract', () => {
  test('uses PR-only history mutation with required permissions', () => {
    expect(workflow).toContain('pull-requests: write')
    expect(workflow).toContain('contents: write')
    expect(workflow).toContain('peter-evans/create-pull-request@v8')
    expect(workflow).toContain('add-paths:')
    expect(workflow).toContain('runs/history.csv')
    expect(workflow).not.toMatch(/\bgit push\b/)
    expect(workflow).not.toContain('repository_dispatch')
  })

  test('targets a current non-mutating Cloudflare route and fails closed', () => {
    expect(workflow).toContain('--method GET')
    expect(workflow).toContain('--path /api/curriculum')
    expect(workflow).toContain('--min-success-rate 1')
    expect(harness).toContain("const requestPath = args.path || '/api/request-pilot'")
    expect(harness).toContain("const requestMethod = String(args.method || 'POST')")
    expect(harness).toContain("process.exitCode = 1")
  })

  test('does not retain duplicate append workflow or temporary output files', () => {
    expect(fs.existsSync(path.join(root, '.github/workflows/append-runs-history.yml'))).toBe(false)
    expect(workflow).not.toContain('tmp_out')
    expect(workflow).not.toContain('Commit runs artifacts')
  })

  test('refuses to append zero-success results', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-history-'))
    const summary = path.join(dir, 'summary.json')
    const history = path.join(dir, 'history.csv')
    fs.writeFileSync(summary, JSON.stringify({
      results: [
        { ok: false, latency: 10 },
        { ok: false, latency: 20 }
      ]
    }))

    const result = spawnSync(
      process.execPath,
      [appendScript, summary, history],
      { encoding: 'utf8' }
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('zero-success')
    expect(fs.existsSync(history)).toBe(false)
  })

  test('appends a successful summary without temporary files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-history-'))
    const summary = path.join(dir, 'summary.json')
    const history = path.join(dir, 'history.csv')
    fs.writeFileSync(summary, JSON.stringify({
      results: [
        { ok: true, latency: 10 },
        { ok: true, latency: 20 }
      ]
    }))

    const result = spawnSync(
      process.execPath,
      [appendScript, summary, history],
      { encoding: 'utf8' }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('APPENDED:2,0,1.00,2,15')
    const lines = fs.readFileSync(history, 'utf8').trim().split(/\r?\n/)
    expect(lines).toHaveLength(2)
  })
})
