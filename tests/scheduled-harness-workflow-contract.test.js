import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import { spawn, spawnSync } from 'child_process'

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

  test('targets the current app origin and fails closed', () => {
    expect(workflow).toContain('TARGET_URL: https://app.autolearnpro.com')
    expect(workflow).not.toContain('HARNESS_URL')
    expect(workflow).toContain('--method GET')
    expect(workflow).toContain('--path /api/curriculum')
    expect(workflow).toContain('--min-success-rate 1')
    expect(harness).toContain("const requestPath = args.path || '/api/curriculum'")
    expect(harness).toContain("const requestMethod = String(args.method || 'GET')")
    expect(harness).toContain("process.exitCode = 1")
  })

  test('does not retain duplicate append workflow or temporary output files', () => {
    expect(fs.existsSync(path.join(root, '.github/workflows/append-runs-history.yml'))).toBe(false)
    expect(workflow).not.toContain('tmp_out')
    expect(workflow).not.toContain('Commit runs artifacts')
  })

  test('writes export before failing a mixed-status success gate', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gate-'))
    const exportPath = path.join(dir, 'run.json')
    let requestCount = 0

    const server = http.createServer((req, res) => {
      requestCount += 1
      res.statusCode = requestCount === 1 ? 500 : 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: res.statusCode === 200 }))
    })

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const child = spawn(
      process.execPath,
      [
        path.join(root, 'scripts/harness.js'),
        '--count', '2',
        '--concurrency', '1',
        '--method', 'GET',
        '--path', '/probe',
        '--min-success-rate', '1',
        '--export', exportPath,
        '--url', `http://127.0.0.1:${address.port}`
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    const exitCode = await new Promise(resolve => child.on('close', resolve))
    await new Promise(resolve => server.close(resolve))

    expect(exitCode).toBe(1)
    expect(fs.existsSync(exportPath)).toBe(true)
    const run = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
    expect(run.results).toHaveLength(2)
    expect(run.results.filter(result => result.ok)).toHaveLength(1)
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
