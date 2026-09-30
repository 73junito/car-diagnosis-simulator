const {
  TELEMETRY_TTL_DAYS,
  validateClientTelemetryEvent,
  isTelemetryRowExpired
} = require('../api/telemetry/contract')

describe('telemetry payload contract', () => {
  test('uses a 30-day logical TTL', () => {
    expect(TELEMETRY_TTL_DAYS).toBe(30)
  })

  test('accepts the approved scenario_started event and normalizes fields', () => {
    const result = validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      payload_json: {
        scenario_id: 12,
        scenario_key: 'charging-system',
        symptom_category: 'No charge'
      }
    })

    expect(result).toEqual({
      ok: true,
      event: {
        sessionId: 'student-dashboard',
        eventType: 'scenario_started',
        payload: {
          scenario_id: 12,
          scenario_key: 'charging-system',
          symptom_category: 'No charge'
        },
        source: 'telemetry'
      }
    })
  })

  test('rejects unknown public event types', () => {
    expect(validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'manual_test',
      payload_json: { scenario_id: 1 }
    })).toEqual({ ok: false, error: 'event_type_not_allowed' })
  })

  test('rejects client-supplied identity or source fields', () => {
    expect(validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      user_id: '00000000-0000-0000-0000-000000000000',
      payload_json: { scenario_id: 1 }
    })).toEqual({ ok: false, error: 'top_level_field_not_allowed' })

    expect(validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      source: 'student',
      payload_json: { scenario_id: 1 }
    })).toEqual({ ok: false, error: 'top_level_field_not_allowed' })
  })

  test('rejects student content outside the approved payload allowlist', () => {
    expect(validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      payload_json: {
        scenario_id: 1,
        student_answer: 'A'
      }
    })).toEqual({ ok: false, error: 'payload_field_not_allowed' })
  })

  test('rejects invalid session ids and missing scenario ids', () => {
    expect(validateClientTelemetryEvent({
      session_id: '',
      event_type: 'scenario_started',
      payload_json: { scenario_id: 1 }
    })).toEqual({ ok: false, error: 'invalid_session_id' })

    expect(validateClientTelemetryEvent({
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      payload_json: {}
    })).toEqual({ ok: false, error: 'scenario_id_required' })
  })

  test('marks expired rows hidden while preserving pre-migration rows', () => {
    expect(isTelemetryRowExpired({ expires_at: '2026-01-01T00:00:00.000Z' }, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(true)
    expect(isTelemetryRowExpired({ expires_at: '2026-03-01T00:00:00.000Z' }, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(false)
    expect(isTelemetryRowExpired({}, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(false)
    expect(isTelemetryRowExpired({ expires_at: 'not-a-date' }, Date.parse('2026-02-01T00:00:00.000Z'))).toBe(true)
  })
})


test('serverless telemetry handler enforces the same public ingress contract', async () => {
  const handler = require('../api/telemetry/events')
  const req = {
    method: 'POST',
    body: {
      session_id: 'student-dashboard',
      event_type: 'scenario_started',
      user_id: '00000000-0000-0000-0000-000000000000',
      payload_json: { scenario_id: 1 }
    }
  }
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return body
    }
  }

  await handler(req, res)

  expect(res.statusCode).toBe(400)
  expect(res.body).toEqual({ ok: false, error: 'top_level_field_not_allowed' })
})
