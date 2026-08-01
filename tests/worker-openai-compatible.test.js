import { requestOpenAI } from '../worker/services/openai-compatible.js'

describe('OpenAI-compatible adapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('successful response extracts choices[0].message.content', async () => {
    const payload = { choices: [{ message: { content: 'Hello' } }] }
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify(payload) })
    const out = await requestOpenAI({ url: 'http://example', model: 'm', prompt: 'p', apiKey: 'k' })
    expect(out).toBe('Hello')
  })

  test('sends authorization header when apiKey present', async () => {
    const payload = { choices: [{ message: { content: 'x' } }] }
    global.fetch = jest.fn(async (url, opts) => {
      expect(opts.headers.Authorization).toBe('Bearer secret')
      return { ok: true, text: async () => JSON.stringify(payload) }
    })
    const out = await requestOpenAI({ url: 'http://example', model: 'm', prompt: 'p', apiKey: 'secret' })
    expect(out).toBe('x')
  })

  test('passes model and messages in body', async () => {
    global.fetch = jest.fn(async (url, opts) => {
      const b = JSON.parse(opts.body)
      expect(b.model).toBe('m123')
      expect(Array.isArray(b.messages)).toBe(true)
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) }
    })
    const out = await requestOpenAI({ url: 'http://example', model: 'm123', prompt: 'prompt', apiKey: 'k' })
    expect(out).toBe('ok')
  })

  test('non-2xx response throws', async () => {
    global.fetch.mockResolvedValue({ ok: false, text: async () => 'error' })
    await expect(requestOpenAI({ url: 'u', model: 'm', prompt: 'p' })).rejects.toThrow(/OpenAI-compatible returned/) 
  })

  test('invalid json throws', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => 'not json' })
    await expect(requestOpenAI({ url: 'u', model: 'm', prompt: 'p' })).rejects.toThrow(/invalid JSON/) 
  })

  test('missing choices/content throws', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({}) })
    await expect(requestOpenAI({ url: 'u', model: 'm', prompt: 'p' })).rejects.toThrow(/no tutor content/) 
  })

  test('forwards abort signal', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    global.fetch.mockRejectedValue(err)
    await expect(requestOpenAI({ url: 'u', model: 'm', prompt: 'p', signal: new AbortController().signal })).rejects.toThrow()
  })
})
