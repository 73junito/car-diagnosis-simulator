const fs = require('fs')
const path = require('path')

describe('public indexing workflow enforcement', () => {
  const root = path.join(__dirname, '..')
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8')
  const baseline = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'production-baseline-monitor.yml'),
    'utf8'
  )

  test('CI enforces the static public sitemap/canonical inventory before install', () => {
    expect(ci).toContain('npm run validate:public-indexability')

    const staticIndex = ci.indexOf('npm run validate:public-indexability')
    const installIndex = ci.indexOf('run: npm ci\n')
    expect(staticIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeGreaterThan(staticIndex)
  })

  test('scheduled production monitor checks live Google crawler access', () => {
    expect(baseline).toContain('id: crawler_monitor')
    expect(baseline).toContain('npm run validate:google-crawler-access')
    expect(baseline).toContain("steps.crawler_monitor.outcome == 'failure'")
    expect(baseline).toContain('Google crawler inventory')
  })
})
