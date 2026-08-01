import { logRequestStart, logRequestCompleted, logRequestFailed } from '../worker/utils/logger.js'

describe('logger', () => {
  test('emits JSON lines without sensitive data', () => {
    // Spy on console.log
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    logRequestStart({ requestId: 'r1', method: 'POST', route: '/api/torquemind-feedback', provider: 'ollama', model: 'm', providerHost: 'h' })
    logRequestCompleted({ requestId: 'r1', method: 'POST', route: '/api/torquemind-feedback', status: 200, durationMs: 10, provider: 'ollama', model: 'm', providerHost: 'h' })
    logRequestFailed({ requestId: 'r2', status: 503, errorType: 'provider_error', provider: 'ollama', model: 'm', providerHost: 'h' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
