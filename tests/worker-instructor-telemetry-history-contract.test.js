const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'instructor-telemetry.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'session-history.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'session-history.js'), 'utf8')
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8'))

describe('Worker instructor telemetry history/export contract', () => {
  test('registers the canonical Worker history route with authenticated CORS', () => {
    expect(worker).toContain('handleInstructorTelemetryHistory')
    expect(worker).toContain("app.use('/api/telemetry/history', instructorTelemetryCors)")
    expect(worker).toContain("app.get('/api/telemetry/history', handleInstructorTelemetryHistory)")
    expect(worker).toContain("app.get('/api/telemetry/export.:format', handleInstructorTelemetryExport)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('requires verified instructor identity and explicit class scope', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(user, supabase)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain("c.req.query('classId')")
    expect(route).toContain("c.json({ error: 'classId is required' }, 400)")
  })

  test('verifies class ownership and limits telemetry to enrolled users', () => {
    expect(route).toContain(".from('classes')")
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain(".from('enrollments')")
    expect(route).toContain(".eq('class_id', cls.id)")
    expect(route).toContain(".from('telemetry_events')")
    expect(route).toContain(".in('user_id', scope.userIds)")
  })

  test('filters logically expired telemetry and caps query size', () => {
    expect(route).toContain(".gt('expires_at', new Date().toISOString())")
    expect(route).toContain('Math.min(Math.max(requestedLimit, 1), 500)')
    expect(route).toContain(".order('created_at', { ascending: false })")
  })

  test('returns a minimized telemetry event shape without user identity', () => {
    expect(route).toContain('function normalizeTelemetryEvent(row)')
    expect(route).toContain('created_at: row.created_at')
    expect(route).toContain('event_type: row.event_type')
    expect(route).toContain('session_id: row.session_id')
    expect(route).toContain('payload: row.payload_json || {}')
    expect(route).not.toContain('user_id: row.user_id')
  })

  test('uses owned classes and shared authenticated API client in the session-history UI', () => {
    expect(html).toContain('id="history-class"')
    expect(html).toContain('<script src="/auth.js"></script>')
    expect(html).toContain('<script src="/apiClient.js"></script>')
    expect(ui).toContain("window.apiGet('/api/classes')")
    expect(ui).toContain("q.set('classId', classId)")
    expect(ui).toContain("window.apiGet('/api/telemetry/history?' + q.toString())")
    expect(ui).toContain("window.location.replace('/sign-in/instructor/')")
  })

  test('uses authenticated class-scoped telemetry export downloads', () => {
    expect(route).toContain('handleInstructorTelemetryExport')
    expect(route).toContain("c.req.param('format')")
    expect(route).toContain("format must be json or csv")
    expect(route).toContain("Content-Disposition': 'attachment; filename=\"session-history.csv\"'")
    expect(route).toContain("Content-Disposition': 'attachment; filename=\"session-history.json\"'")
    expect(route).toContain("Cache-Control': 'private, no-store'")
    expect(route).toContain('buildTelemetryCsv(result.rows)')
    expect(ui).toContain("q.set('classId', classId)")
    expect(ui).toContain("headers: { Authorization: 'Bearer ' + token }")
    expect(ui).toContain("downloadTelemetry('json')")
    expect(ui).toContain("downloadTelemetry('csv')")
  })

  test('removes telemetry history from known production gaps', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/telemetry/history')
    expect(patterns).not.toContain('/api/telemetry/export.:param')
    expect(patterns).toContain('/api/telemetry/stream')
    expect(patterns).toContain('/api/telemetry/events')
  })
})
