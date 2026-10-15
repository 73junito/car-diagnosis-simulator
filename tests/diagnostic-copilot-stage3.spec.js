const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const activation = fs.readFileSync(path.join(root,'worker/runtime/diagnostic-copilot-activation.js'),'utf8')
const featureFlags = fs.readFileSync(path.join(root,'worker/runtime/feature-flags.js'),'utf8')
const model = fs.readFileSync(path.join(root,'worker/services/diagnostic-copilot-model.js'),'utf8')
const route = fs.readFileSync(path.join(root,'worker/routes/diagnostic-copilot.js'),'utf8')
const worker = fs.readFileSync(path.join(root,'worker/index.js'),'utf8')
const wrangler = fs.readFileSync(path.join(root,'wrangler.app.jsonc'),'utf8')
const ui = fs.readFileSync(path.join(root,'dashboard/student/copilot/index.html'),'utf8')
const client = fs.readFileSync(path.join(root,'dashboard/student/copilot/copilot.js'),'utf8')
const dashboard = fs.readFileSync(path.join(root,'dashboard/student/index.html'),'utf8')
const docs = fs.readFileSync(path.join(root,'docs/architecture/hybrid-agentic-roadmap.md'),'utf8')

describe('Hybrid agentic roadmap Stage 3', () => {
  test('production and preview stay default-off while staging is enabled for validation', () => {
    const config = JSON.parse(wrangler)
    expect(config.previews.vars.TORQUEMIND_COPILOT_ENABLED).toBe('false')
    expect(config.vars.TORQUEMIND_COPILOT_ENABLED).toBe('false')
    expect(config.env.staging.vars.TORQUEMIND_COPILOT_ENABLED).toBe('true')
    expect(config.previews.vars.TORQUEMIND_COPILOT_KILL_SWITCH).toBe('false')
    expect(config.vars.TORQUEMIND_COPILOT_KILL_SWITCH).toBe('false')
    expect(config.env.staging.vars.TORQUEMIND_COPILOT_KILL_SWITCH).toBe('false')
  })

  test('activation requires governed feature flag, healthy persistence config, and no kill switch', () => {
    expect(activation).toContain("resolveFeatureFlag('diagnosticCopilot', env)")
    expect(featureFlags).toContain("envVar: 'TORQUEMIND_COPILOT_ENABLED'")
    expect(featureFlags).toContain("killSwitchEnvVar: 'TORQUEMIND_COPILOT_KILL_SWITCH'")
    expect(activation).toContain("persistenceMode === 'supabase'")
    expect(activation).toContain("reason: !enabled")
    expect(activation).toContain("'kill-switch'")
    expect(activation).toContain("'persistence-unhealthy'")
  })

  test('provider configuration is validated before model activation', () => {
    expect(activation).toContain('validateProviderConfig')
    expect(activation).toContain('sanitizeDiagnostics')
    expect(activation).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  test('model context excludes VIN and account identity', () => {
    expect(model).toContain('compactSession')
    expect(model).not.toMatch(/\bvin\b/i)
    expect(model).not.toMatch(/user_id|userId|email|account/i)
    expect(route).toContain('vehicle: publicVehicle(session.vehicle)')
  })

  test('model is forbidden from inventing diagnostic authority', () => {
    expect(model).toContain('Use only the deterministic status and allowedNextActions supplied below.')
    expect(model).toContain('Do not invent facts, measurements, evidence, specifications, answer keys, or additional procedures.')
    expect(model).toContain('You are advisory only')
  })

  test('actionable next step always comes from deterministic planner, not provider output', () => {
    expect(route).toContain('nextAction: plan.nextActions[0]')
    expect(route).toContain('modelMayChooseNextAction: false')
    expect(route).not.toContain('nextAction: modelAdvice.nextAction')
  })

  test('technician verification remains mandatory in API and UI', () => {
    expect(route).toContain('Technician verification is required before treating any diagnostic direction as final.')
    expect(ui).toContain('does not grade, approve, certify, or replace technician verification')
    expect(client).toContain('Technician verification is required')
  })

  test('provider call is gated by auth, ownership, persistence health, and approved evidence', () => {
    expect(route).toContain('const auth = await authenticate(c)')
    expect(route).toContain('await persistenceHealth(supabase)')
    expect(route).toContain('await ownedSession(supabase, user.id, sessionId)')
    expect(route).toContain("row.status !== 'open'")
    expect(route).toContain("plan.evidenceGate?.allowed !== true")
    expect(route).toContain('Model assistance is blocked until the deterministic evidence gate is satisfied.')
  })

  test('provider latency is bounded and errors are observable', () => {
    expect(route).toContain('TORQUEMIND_COPILOT_TIMEOUT_MS')
    expect(route).toContain('Math.min(Math.max(raw, 1000), 30000)')
    expect(route).toContain('AbortController')
    expect(route).toContain('logCopilotStarted')
    expect(route).toContain('logCopilotCompleted')
    expect(route).toContain('logCopilotFailed')
  })

  test('model output budget is bounded', () => {
    expect(model).toContain('numPredict: 180')
    expect(model).toContain('temperature: 0.1')
  })

  test('worker exposes health and advice routes only inside authenticated copilot namespace', () => {
    expect(worker).toContain("app.get('/api/copilot/health', handleDiagnosticCopilotHealth)")
    expect(worker).toContain("app.post('/api/copilot/sessions/:sessionId/advice', handleDiagnosticAdvice)")
    expect(worker).not.toContain("/api/copilot/chat")
    expect(worker).not.toContain("/api/copilot/grade")
  })

  test('student workspace is linked from dashboard and uses auth.js', () => {
    expect(dashboard).toContain('/dashboard/student/copilot/')
    expect(ui).toContain('<script src="/auth.js"></script>')
    expect(client).toContain("typeof window.getAccessToken==='function'")
    expect(client).toContain("Authorization:'Bearer '+accessToken")
  })

  test('stage 3 documentation keeps production activation human-controlled', () => {
    expect(docs).toContain('Preview and production configuration remain disabled by default.')
    expect(docs).toContain('explicit configuration change after staging validation')
    expect(docs).toContain('No grading, publication, release, credential, or assessment-eligibility authority')
  })
})
