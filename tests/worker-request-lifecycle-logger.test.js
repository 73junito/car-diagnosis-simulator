import {
  logHttpRequestStarted,
  logHttpRequestCompleted,
  logHttpRequestFailed
} from '../worker/utils/request-lifecycle-logger.js'

describe('structured request lifecycle logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    console.log.mockRestore()
  })

  test('emits correlated structured lifecycle records', () => {
    const correlation = {
      requestId: 'request-12345678',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      cfRay: '8abc1234def56789-MCI'
    }

    logHttpRequestStarted({ surface: 'app', correlation, method: 'GET', path: '/api/health' })
    logHttpRequestCompleted({
      surface: 'app',
      correlation,
      method: 'GET',
      path: '/api/health',
      status: 200,
      durationMs: 12
    })
    logHttpRequestFailed({
      surface: 'app',
      correlation,
      method: 'GET',
      path: '/api/health',
      errorType: 'TypeError',
      durationMs: 3
    })

    const payloads = console.log.mock.calls.map(([line]) => JSON.parse(line))
    expect(payloads[0]).toMatchObject({
      event: 'autolearnpro.http.started',
      surface: 'app',
      requestId: 'request-12345678',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      cfRay: '8abc1234def56789-MCI'
    })
    expect(payloads[1]).toMatchObject({
      event: 'autolearnpro.http.completed',
      status: 200,
      durationMs: 12
    })
    expect(payloads[2]).toMatchObject({
      event: 'autolearnpro.http.failed',
      errorType: 'TypeError',
      durationMs: 3
    })
  })
})
