import app from '../worker/index.js'
import { handleFeedback as feedbackHandler } from '../worker/routes/torquemind-feedback.js'

describe('Worker torquemind-feedback route (integration-style)', () => {
  const validBody = {
    scenario: 'Engine cranks but will not start.',
    question: 'What should be checked first?',
    studentAnswer: 'Replace the starter.',
    correctAnswer: 'Verify fuel and spark.'
  }

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  async function post(body, env = {}) {
    const bodyStr = JSON.stringify(body)
    // build a lightweight mock context request for direct handler calls
    if (typeof feedbackHandler === 'function') {
      const reqMock = {
        json: async () => JSON.parse(bodyStr),
        text: async () => bodyStr,
        body: bodyStr,
        headers: { get: () => 'application/json' }
      }
      const c = { req: reqMock, env, json: (v, s) => ({ status: s || 200, body: v }) }
      const result = await feedbackHandler(c)
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
        return { status: result.status, body: result.body, headers: {} }
      }
    }
    const req = new Request('http://localhost/api/torquemind-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bodyStr)) },
      body: bodyStr
    })
    return app.fetch(req, { env })
  }

  test('valid Ollama response -> 200', async () => {
    const payload = { message: { content: JSON.stringify({ reasonIncorrect: 'A', reasonCorrect: 'B', aseConcept: 'C', nextStep: 'D' }) } }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })

    const res = await post(validBody, { TORQUEMIND_AI_PROVIDER: 'ollama' })
    let text
    if (typeof res.text === 'function') {
      text = await res.text()
    } else if (res.body) {
      if (typeof res.body === 'object') {
        text = JSON.stringify(res.body)
      } else {
        try {
          text = await res.body.text()
        } catch (e) {
          text = String(res.body)
        }
      }
    } else {
      text = JSON.stringify(res)
    }
    // response checked in assertions
    expect(res.status).toBe(200)
    const json = JSON.parse(text)
    expect(json.reasonIncorrect).toBe('A')
  })

  test('unsupported provider -> 503', async () => {
    const res = await post(validBody, { TORQUEMIND_AI_PROVIDER: 'openai' })
    expect(res.status).toBe(503)
  })

  test('invalid AI JSON -> 200 fallback payload', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => 'not json' })
    const res = await post(validBody, { TORQUEMIND_AI_PROVIDER: 'ollama' })
    expect(res.status).toBe(200)
    const body = res.body || {}
    expect(typeof body.reasonIncorrect).toBe('string')
    expect(typeof body.reasonCorrect).toBe('string')
    expect(typeof body.aseConcept).toBe('string')
    expect(typeof body.nextStep).toBe('string')
  })

  test('missing required response field -> 200 fallback payload', async () => {
    const payload = { message: { content: JSON.stringify({ reasonIncorrect: 'A', reasonCorrect: 'B', aseConcept: 'C' }) } }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })
    const res = await post(validBody, { TORQUEMIND_AI_PROVIDER: 'ollama' })
    expect(res.status).toBe(200)
    const body = res.body || {}
    expect(typeof body.reasonIncorrect).toBe('string')
    expect(typeof body.reasonCorrect).toBe('string')
    expect(typeof body.aseConcept).toBe('string')
    expect(typeof body.nextStep).toBe('string')
  })

  test('aborted request -> 504', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    global.fetch.mockRejectedValue(err)
    const res = await post(validBody, { TORQUEMIND_AI_PROVIDER: 'ollama' })
    expect(res.status).toBe(504)
  })

    test('request id header preserved when rate limiting middleware present', async () => {
      const req = new Request('http://localhost/api/torquemind-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'test-rid' },
        body: JSON.stringify({ prompt: 'hi' })
      })
      const res = await app.fetch(req)
      expect(res.headers.get('x-request-id')).toBeTruthy()
    })
})
