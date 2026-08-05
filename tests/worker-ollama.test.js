import { requestOllama } from '../worker/services/ollama.js'
import { validateProviderConfig } from '../worker/config/ai-config.js'

describe('Ollama adapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('returns message.content when present', async () => {
    const payload = { message: { content: '{"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"}' } }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })

    const res = await requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })
    expect(res).toContain('reasonIncorrect')
  })

  test('falls back to message.thinking', async () => {
    const payload = { message: { thinking: '{"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"}' } }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })

    const res = await requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })
    expect(res).toContain('reasonIncorrect')
  })

  test('falls back to legacy response field', async () => {
    const payload = { response: '{"reasonIncorrect":"A","reasonCorrect":"B","aseConcept":"C","nextStep":"D"}' }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })

    const res = await requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })
    expect(res).toContain('reasonIncorrect')
  })

  test('rejects non-2xx', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' })
    await expect(requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })).rejects.toThrow('Ollama returned 500')
  })

  test('rejects invalid JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => 'not json' })
    await expect(requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })).rejects.toThrow('Ollama returned invalid JSON')
  })

  test('rejects empty content', async () => {
    const payload = { message: { content: '' } }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })
    await expect(requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })).rejects.toThrow('Ollama returned no tutor content')
  })

  test('sends model and messages in request body', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    global.fetch.mockImplementationOnce((url, opts) => {
      const body = JSON.parse(opts.body)
      expect(body.model).toBe('m')
      expect(Array.isArray(body.messages)).toBe(true)
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    })

    await requestOllama({ url: 'http://example', model: 'm', prompt: 'p' })
  })

  test('forwards AbortSignal', async () => {
    const abort = new AbortController()
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    await requestOllama({ url: 'http://example', model: 'm', prompt: 'p', signal: abort.signal })
    expect(global.fetch).toHaveBeenCalled()
  })

  test('sends Access headers when both secrets provided', async () => {
    global.fetch.mockImplementationOnce((url, opts) => {
      expect(opts.headers['CF-Access-Client-Id']).toBe('access-id')
      expect(opts.headers['CF-Access-Client-Secret']).toBe('access-secret')
      expect(opts.headers.authorization).toBeUndefined()
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    })

    await requestOllama({ url: 'http://example', model: 'm', prompt: 'p', accessClientId: 'access-id', accessClientSecret: 'access-secret' })
  })

  test('uses bearer auth when only apiKey present', async () => {
    global.fetch.mockImplementationOnce((url, opts) => {
      expect(opts.headers.authorization).toBe('Bearer mykey')
      expect(opts.headers['CF-Access-Client-Id']).toBeUndefined()
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    })

    await requestOllama({ url: 'http://example', model: 'm', prompt: 'p', apiKey: 'mykey' })
  })

  test('access auth takes precedence over bearer when both provided', async () => {
    global.fetch.mockImplementationOnce((url, opts) => {
      expect(opts.headers['CF-Access-Client-Id']).toBe('access-id')
      expect(opts.headers['CF-Access-Client-Secret']).toBe('access-secret')
      expect(opts.headers.authorization).toBeUndefined()
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ message: { content: 'ok' } }) })
    })

    await requestOllama({ url: 'http://example', model: 'm', prompt: 'p', apiKey: 'mykey', accessClientId: 'access-id', accessClientSecret: 'access-secret' })
  })

  test('thrown errors do not include secrets', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'provider detail containing secret: access-secret' })
    await expect(requestOllama({ url: 'http://example', model: 'm', prompt: 'p', accessClientId: 'access-id', accessClientSecret: 'access-secret' })).rejects.toThrow('Ollama returned 500')
  })

  test('missing one Access credential fails config validation for non-local host', () => {
    expect(() => validateProviderConfig({ provider: 'ollama', url: 'https://ollama.example.com/api/chat', apiKey: '', env: { TORQUEMIND_AI_MODEL: 'm', OLLAMA_ACCESS_CLIENT_ID: 'id' } })).toThrow()
  })
})
