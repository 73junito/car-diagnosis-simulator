const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'instructor-telemetry.js'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'live-session.js'), 'utf8')
const legacy = fs.readFileSync(path.join(root, 'dashboard', 'live-telemetry.js'), 'utf8')
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8'))

describe('Worker instructor telemetry stream contract', () => {
  test('registers authenticated Worker stream route', () => {
    expect(worker).toContain("app.use('/api/telemetry/stream', instructorTelemetryCors)")
    expect(worker).toContain("app.get('/api/telemetry/stream', handleInstructorTelemetryStream)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('reuses canonical instructor and owned-class authorization', () => {
    expect(route).toContain('const auth = await authorizeInstructor(c)')
    expect(route).toContain('loadOwnedClassUserIds(auth, classId)')
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain(".in('user_id', scope.userIds)")
  })

  test('filters expiry, supports a bounded cursor snapshot, and minimizes rows', () => {
    expect(route).toContain(".gt('expires_at', new Date().toISOString())")
    expect(route).toContain("if (since) query = query.gt('created_at', since)")
    expect(route).toContain('Math.min(Math.max(requestedLimit, 1), 250)')
    expect(route).toContain('normalizeTelemetryEvent')
    expect(route).not.toContain('payload: row.user_id')
  })

  test('returns SSE with private no-store semantics', () => {
    expect(route).toContain("'Content-Type': 'text/event-stream; charset=utf-8'")
    expect(route).toContain("'Cache-Control': 'private, no-store'")
    expect(route).toContain("'X-Accel-Buffering': 'no'")
    expect(route).toContain("lines.push('event: telemetry')")
    expect(route).toContain("lines.push('data: ' + JSON.stringify(row))")
  })

  test('browser sends bearer auth, classId, and cursor without EventSource or role-localStorage', () => {
    expect(ui).toContain("window.apiGet('/api/classes')")
    expect(ui).toContain("Authorization: 'Bearer ' + token")
    expect(ui).toContain("q.set('since', cursor)")
    expect(ui).toContain("setTimeout(connect, 3000)")
    expect(ui).not.toContain('new EventSource')
    expect(ui).not.toContain("torquemindRole")
    expect(legacy).not.toContain('/api/telemetry/stream')
    expect(legacy).not.toContain('EventSource')
  })

  test('closes G6 stream inventory gap', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/telemetry/stream')
  })
})
