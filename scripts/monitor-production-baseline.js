'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = path.join(ROOT, 'reports', 'production-baseline-monitor.json')

const GATES = [
  { id: 'source-rights-closure', script: 'audit:curriculum-source-rights' },
  { id: 'state-privacy-ai-overlays', script: 'validate:state-privacy-ai-overlays' },
  { id: 'curriculum-reference-coverage', script: 'validate:curriculum-reference-coverage-baseline' },
  { id: 'assessment-governance-boundary', script: 'validate:assessment-governance-boundary' },
  { id: 'production-surfaces', script: 'validate:production-surfaces' },
  { id: 'google-crawler-access', script: 'validate:google-crawler-access' },
  { id: 'public-indexability', script: 'validate:public-indexability' },
  { id: 'production-release-baseline', script: 'validate:production-release-baseline' }
]

function defaultRunner(gate) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return spawnSync(command, ['run', gate.script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env
  })
}

function runMonitor(runner = defaultRunner, now = () => new Date()) {
  const startedAt = now().toISOString()
  const results = []

  for (const gate of GATES) {
    const result = runner(gate)
    const status = typeof result.status === 'number' ? result.status : 1
    results.push({
      id: gate.id,
      script: gate.script,
      ok: status === 0,
      exit_code: status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim()
    })
  }

  const failures = results.filter((item) => !item.ok)
  const report = {
    schema_version: '1.0.0',
    monitor: 'phase7a-production-baseline',
    started_at: startedAt,
    completed_at: now().toISOString(),
    github_sha: process.env.GITHUB_SHA || null,
    production_surfaces: [
      'https://autolearnpro.com/',
      'https://app.autolearnpro.com/',
      'https://exam.autolearnpro.com/'
    ],
    gates_total: results.length,
    gates_passed: results.length - failures.length,
    gates_failed: failures.length,
    ok: failures.length === 0,
    results
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n')

  return report
}

function main() {
  const report = runMonitor()

  for (const result of report.results) {
    console.log(`${result.ok ? '[PASS]' : '[FAIL]'} ${result.id}`)
    if (result.stdout) console.log(result.stdout)
    if (result.stderr) console.error(result.stderr)
  }

  console.log(
    `Production baseline monitor: ${report.gates_passed}/${report.gates_total} gates passed`
  )
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`)

  if (!report.ok) process.exit(1)
}

if (require.main === module) main()

module.exports = { GATES, REPORT_PATH, runMonitor }
