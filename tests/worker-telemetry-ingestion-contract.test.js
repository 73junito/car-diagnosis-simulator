const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'telemetry-ingest.js'), 'utf8')
const student = fs.readFileSync(path.join(root, 'dashboard', 'student', 'student.js'), 'utf8')
const policy = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'compliance', 'telemetry-payload-contract.json'), 'utf8'))
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8'))

describe('Worker telemetry ingestion contract', () => {
  test('registers canonical Worker telemetry POST with auth-capable CORS', () => {
    expect(worker).toContain("app.post('/api/telemetry/events', handleTelemetryEventIngest)")
    expect(worker).toContain("allowMethods: ['POST', 'OPTIONS']")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('matches the approved scenario_started-only public ingress contract', () => {
    expect(policy.public_ingress.allowed_top_level_fields).toEqual([
      'session_id',
      'event_type',
      'payload_json'
    ])
    expect(Object.keys(policy.public_ingress.allowed_events)).toEqual(['scenario_started'])

    expect(route).toContain("'session_id'")
    expect(route).toContain("'event_type'")
    expect(route).toContain("'payload_json'")
    expect(route).toContain("input.event_type !== 'scenario_started'")
    expect(route).toContain("'top_level_field_not_allowed'")
    expect(route).toContain("'payload_field_not_allowed'")
  })

  test('fails closed on oversized and invalid JSON payloads', () => {
    expect(route).toContain('const MAX_BODY_BYTES = 10 * 1024')
    expect(route).toContain("error: 'payload_too_large'")
    expect(route).toContain("error: 'invalid_json'")
  })

  test('does not trust client identity, source, or expiry fields', () => {
    expect(route).not.toContain("'user_id',")
    expect(route).not.toContain("'source',")
    expect(route).not.toContain("'expires_at',")
    expect(route).toContain('resolveOptionalUserId')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('user_id: identity.userId')
    expect(route).toContain("source: 'telemetry'")
  })

  test('stores only governed telemetry fields and relies on DB TTL default', () => {
    expect(route).toContain(".from('telemetry_events').insert(row)")
    expect(route).toContain('session_id: validation.event.session_id')
    expect(route).toContain('event_type: validation.event.event_type')
    expect(route).toContain('payload_json: validation.event.payload_json')
    expect(route).not.toContain('expires_at:')
  })

  test('authenticated student writer sends bearer token and anonymous fallback stays contract-safe', () => {
    expect(student).toContain("fetch('/api/telemetry/events'")
    expect(student).toContain("Authorization: 'Bearer ' + token")
    expect(student).toContain('keepalive: true')
    expect(student).toContain("navigator.sendBeacon('/api/telemetry/events', JSON.stringify(payload))")
    expect(student).not.toContain('user_id:')
    expect(student).not.toContain('source:')
    expect(student).not.toContain('expires_at:')
  })

  test('removes telemetry ingestion from known production gaps', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/telemetry/events')
    expect(patterns).not.toContain('/api/telemetry/stream')
  })
})
