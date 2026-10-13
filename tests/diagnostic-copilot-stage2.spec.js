const fs = require('fs')
const path = require('path')
const {
  BoundedToolExecutor
} = require('../src/ai')

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261013005905_add_diagnostic_copilot_stage2.sql'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/diagnostic-copilot.js'),
  'utf8'
)
const worker = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')

describe('Hybrid agentic roadmap Stage 2', () => {
  test('persistence tables are server-only and RLS protected', () => {
    for (const table of [
      'diagnostic_sessions',
      'diagnostic_session_evidence',
      'diagnostic_executions',
      'diagnostic_execution_events',
      'diagnostic_reports'
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })

  test('self ownership is represented and indexed throughout persistence', () => {
    expect(migration.match(/user_id uuid not null references auth\.users\(id\)/g)?.length).toBeGreaterThanOrEqual(5)
    expect(migration).toContain('idx_diagnostic_sessions_user_updated')
    expect(migration).toContain('idx_diagnostic_session_evidence_user_session')
    expect(migration).toContain('idx_diagnostic_executions_user_session')
    expect(migration).toContain('idx_diagnostic_reports_user_session')
    expect(migration).toContain('diagnostic_session_evidence_owner_fkey')
    expect(migration).toContain('diagnostic_executions_owner_fkey')
    expect(migration).toContain('diagnostic_execution_events_owner_fkey')
    expect(migration).toContain('diagnostic_reports_owner_fkey')
    expect(migration).toContain('references public.diagnostic_sessions(id, user_id)')
    expect(migration).toContain('references public.diagnostic_executions(id, session_id, user_id)')
  })

  test('execution ledger has bounded attempts, timeout and idempotency', () => {
    expect(migration).toContain('unique (user_id, idempotency_key)')
    expect(migration).toContain("attempt_count integer not null default 0 check (attempt_count between 0 and 2)")
    expect(migration).toContain("max_attempts integer not null default 1 check (max_attempts between 1 and 2)")
    expect(migration).toContain("timeout_ms integer not null default 2500 check (timeout_ms between 250 and 5000)")
  })

  test('worker routes are authenticated and expose plan/report preparation only', () => {
    expect(worker).toContain("app.all('/api/copilot/sessions', handleDiagnosticSessions)")
    expect(worker).toContain("app.post('/api/copilot/sessions/:sessionId/plan', handleDiagnosticPlan)")
    expect(worker).toContain("app.post('/api/copilot/sessions/:sessionId/report', handleDiagnosticReport)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']")
    expect(worker).not.toContain("/api/copilot/model")
    expect(worker).not.toContain("/api/copilot/chat")
  })

  test('service-role queries remain self-scoped by authenticated user id', () => {
    expect(route).toContain(".eq('user_id', user.id)")
    expect(route).toContain("user_id: user.id")
    expect(route).toContain('verifySupabaseToken')
    expect(route).not.toContain('user_metadata')
  })

  test('raw VIN is persisted server-side but stripped from API responses', () => {
    expect(route).toContain("delete vehicle.vin")
    expect(route).toContain("vehicle_json: session.vehicle")
    expect(route).not.toMatch(/return\s+c\.json\([^)]*vehicle_json/)
  })

  test('evidence approval is resolved by the server from governed chunks', () => {
    expect(route).toContain(".from('source_chunks')")
    expect(route).toContain(".eq('approved', true)")
    expect(route).toContain(".eq('status', 'approved')")
    expect(route).toContain(".eq('approved_sources.status', 'approved')")
    expect(route).toContain("sourceApproval: 'approved'")
    expect(route).not.toContain('text_excerpt')
  })

  test('stage 2 refuses to infer vehicle-specific source authority', () => {
    expect(route).toContain("if (claimScope !== 'general')")
    expect(route).toContain('does not infer primary vehicle-specific authority')
    expect(route).toContain("sourceAuthority: 'instructional'")
  })

  test('idempotency key is validated and bound to input hash', () => {
    expect(route).toContain('IDEMPOTENCY_RE')
    expect(route).toContain('Idempotency key is already bound to different input')
    expect(route).toContain("existing.input_hash !== inputHash")
    expect(route).toContain("existing.operation !== operation")
    expect(route).toContain("existing.session_id !== sessionId")
  })

  test('reports persist provenance references before execution success', () => {
    const reportInsert = route.indexOf(".from('diagnostic_reports')")
    const finish = route.indexOf('await finishExecution(supabase, begun.execution, result)')
    expect(reportInsert).toBeGreaterThan(-1)
    expect(finish).toBeGreaterThan(reportInsert)
    expect(route).toContain('evidence_chunk_ids: evidence.map((item) => item.chunkId)')
  })

  test('bounded tool executor rejects tools outside explicit allowlist', async () => {
    const gateway = { execute: jest.fn() }
    await expect(BoundedToolExecutor.executeBoundedTool({
      gateway,
      toolId: 'unknown-tool'
    })).rejects.toMatchObject({ code: 'tool_not_allowed' })
    expect(gateway.execute).not.toHaveBeenCalled()
  })

  test('bounded tool executor succeeds through the allowlisted deterministic tool', async () => {
    const gateway = {
      execute: jest.fn(async () => ({ normalizedData: { ok: true } }))
    }
    const events = []
    const result = await BoundedToolExecutor.executeBoundedTool({
      gateway,
      toolId: 'circuit-engine',
      timeoutMs: 250,
      maxAttempts: 1,
      onEvent: async (event) => events.push(event)
    })

    expect(result.status).toBe('succeeded')
    expect(result.attemptCount).toBe(1)
    expect(gateway.execute).toHaveBeenCalledTimes(1)
    expect(events.map((event) => event.eventType)).toEqual([
      'attempt_started',
      'attempt_succeeded'
    ])
  })

  test('bounded tool executor enforces retry and timeout ceilings', async () => {
    const gateway = {
      execute: jest.fn(async () => {
        const error = new Error('temporary')
        error.code = 'temporary_failure'
        throw error
      })
    }

    await expect(BoundedToolExecutor.executeBoundedTool({
      gateway,
      toolId: 'circuit-engine',
      timeoutMs: 250,
      maxAttempts: 2
    })).rejects.toMatchObject({
      code: 'temporary_failure',
      attemptCount: 2
    })
    expect(gateway.execute).toHaveBeenCalledTimes(2)

    await expect(BoundedToolExecutor.executeBoundedTool({
      gateway,
      toolId: 'circuit-engine',
      timeoutMs: 200,
      maxAttempts: 1
    })).rejects.toThrow(/timeoutMs/)
  })

  test('no production model or UI activation is introduced in stage 2', () => {
    const docs = fs.readFileSync(path.join(root, 'docs/architecture/hybrid-agentic-roadmap.md'), 'utf8')
    expect(docs).toContain('external LLM execution')
    expect(docs).toContain('user-facing Copilot UI')
    expect(route).not.toMatch(/openai|ollama|anthropic|gemini/i)
  })
})
