const fs = require('fs')
const path = require('path')

describe('production runtime synthetic monitor workflow', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'production-runtime-synthetic-monitor.yml'),
    'utf8'
  )

  test('runs every fifteen minutes with manual dispatch', () => {
    expect(workflow).toContain("cron: '7,22,37,52 * * * *'")
    expect(workflow).toContain('workflow_dispatch: {}')
  })

  test('uses the reviewed Node release baseline and deterministic install', () => {
    expect(workflow).toContain("node-version: '22.19.0'")
    expect(workflow).toContain('npm ci --ignore-scripts')
  })

  test('requires two consecutive production failures before failing the workflow', () => {
    expect(workflow.match(/npm run monitor:production-runtime/g)).toHaveLength(2)
    expect(workflow).toContain('sleep 120')
    expect(workflow).toContain('failed twice consecutively')
  })

  test('retains machine-readable monitor evidence', () => {
    expect(workflow).toContain('reports/production-runtime-synthetic*.json')
    expect(workflow).toContain('retention-days: 30')
  })
})
