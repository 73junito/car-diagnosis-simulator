import {
  resolveRequestCorrelation,
  applyCorrelationResponseHeaders
} from '../worker/utils/request-correlation.js'

describe('worker request correlation', () => {
  test('preserves a safe request id and extracts W3C trace + Cloudflare ray ids', () => {
    const values = new Map([
      ['x-request-id', 'request-12345678'],
      ['traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
      ['cf-ray', '8abc1234def56789-MCI']
    ])
    const request = { headers: { get: (name) => values.get(name) || null } }

    expect(resolveRequestCorrelation(request)).toEqual({
      requestId: 'request-12345678',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      cfRay: '8abc1234def56789-MCI',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    })
  })

  test('generates a request id and rejects malformed trace/ray values', () => {
    const values = new Map([
      ['x-request-id', 'bad!'],
      ['traceparent', 'not-a-trace'],
      ['cf-ray', 'bad ray']
    ])
    const request = { headers: { get: (name) => values.get(name) || null } }

    const correlation = resolveRequestCorrelation(request)
    expect(correlation.requestId.length).toBeGreaterThanOrEqual(8)
    expect(correlation.traceId).toBeNull()
    expect(correlation.cfRay).toBeNull()
    expect(correlation.traceparent).toBeNull()
  })

  test('adds correlation headers without changing response status/body', async () => {
    const original = new Response('ok', { status: 202, headers: { 'content-type': 'text/plain' } })
    const response = applyCorrelationResponseHeaders(original, {
      requestId: 'request-12345678',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736'
    })

    expect(response.status).toBe(202)
    expect(response.headers.get('x-request-id')).toBe('request-12345678')
    expect(response.headers.get('x-trace-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  })
})
