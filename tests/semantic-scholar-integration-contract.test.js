/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')

describe('Semantic Scholar integration contract', () => {
  const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
  const route = fs.readFileSync(path.join(root, 'worker/routes/semantic-scholar-research.js'), 'utf8')
  const service = fs.readFileSync(path.join(root, 'worker/services/semantic-scholar.js'), 'utf8')
  const appConfig = fs.readFileSync(path.join(root, 'wrangler.app.jsonc'), 'utf8')
  const publicConfig = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')
  const attribution = fs.readFileSync(path.join(root, 'public-site/research-sources/index.html'), 'utf8')
  const integrationDocs = fs.readFileSync(path.join(root, 'docs/SEMANTIC_SCHOLAR_INTEGRATION.md'), 'utf8')

  test('routes are app-origin only and require bearer authentication', () => {
    expect(workerIndex).toContain("origin: 'https://app.autolearnpro.com'")
    expect(workerIndex).toContain("allowHeaders: ['Content-Type', 'Authorization']")
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('user?.app_metadata?.role')
    expect(route).toContain("new Set(['teacher', 'instructor', 'professor', 'admin'])")
    expect(route).toContain(".from('profiles')")
    expect(route).toContain(".select('role')")
    expect(route).toContain(".eq('id', user.id)")
    expect(route).toContain('Teacher, instructor, professor, or admin access required')
  })

  test('API key remains a server-side Cloudflare Secrets Store binding', () => {
    expect(service).toContain("'x-api-key': apiKey")
    expect(service).toContain("typeof binding.get === 'function'")
    expect(service).toContain('await binding.get()')
    expect(appConfig).toContain('"secrets_store_secrets"')
    expect(appConfig).toContain('"binding": "SEMANTIC_SCHOLAR_API_KEY"')
    expect(appConfig).toContain('"store_id": "c32646eb8bd1485b89b3dbf184fe933d"')
    expect(appConfig).toContain('"secret_name": "Semantic_Scholar"')
    expect(publicConfig).not.toContain('SEMANTIC_SCHOLAR_API_KEY')
    expect(workerIndex).not.toMatch(/s2k-/i)
    expect(route).not.toMatch(/s2k-/i)
    expect(service).not.toMatch(/s2k-/i)
  })

  test('production integration uses one global Durable Object quota below 1 RPS', () => {
    expect(service).toContain("idFromName('semantic-scholar-global')")
    expect(service).toContain('windowSeconds = positiveInt')
    expect(appConfig).toContain('"SEMANTIC_SCHOLAR_RATE_WINDOW_SECONDS": "2"')
    expect(service).toContain('globalThis.caches?.default')
    expect(service).toContain('inflight')
    expect((appConfig.match(/"SEMANTIC_SCHOLAR_ENABLED": "true"/g) || [])).toHaveLength(1)
    expect((appConfig.match(/"SEMANTIC_SCHOLAR_ENABLED": "false"/g) || [])).toHaveLength(2)
  })

  test('research results remain outside curriculum and scored-assessment approval', () => {
    expect(route).toContain("curriculumApproval: 'not-granted'")
    expect(route).toContain("scoredAssessmentEligibility: 'not-granted'")
    expect(route).toContain('humanReviewRequired: true')
    expect(service).toContain("reviewStatus: 'unreviewed'")
    expect(service).toContain("assessmentEligibility: 'none'")
  })

  test('public site includes Semantic Scholar attribution, logo, API UTM, and evidence boundary', () => {
    expect(attribution).toContain('Semantic Scholar')
    expect(attribution).toContain('Allen Institute for AI')
    expect(attribution).toContain('https://www.semanticscholar.org/?utm_source=api')
    expect(attribution).toContain('/assets/semantic-scholar-logo.svg')
    expect(attribution).toContain('alt="Semantic Scholar"')
    expect(attribution).toContain('does not automatically become approved curriculum evidence')
    expect(attribution).toContain('does not use the Semantic Scholar API to republish full copyrighted articles')
  })

  test('documents that attribution does not replace license-scope authorization', () => {
    expect(integrationDocs).toContain('Expanded License')
    expect(integrationDocs).toContain('commercial use')
    expect(integrationDocs).toContain('must not treat possession of an API key or attribution alone')
  })
})
