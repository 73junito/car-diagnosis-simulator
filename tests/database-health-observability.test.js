import {
  DEFAULT_TIMEOUT_MS,
  probeDatabaseHealth
} from '../worker/runtime/database-health.js'

describe('database health observability', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    console.log.mockRestore()
  })

  test('performs a bounded read-only Supabase probe and returns sanitized health', async () => {
    const fetcher = jest.fn(async (url, options) => {
      expect(url).toBe(
        'https://example.supabase.co/rest/v1/curriculum_lesson_plans?select=id&limit=1'
      )
      expect(options.method).toBe('GET')
      expect(options.headers.apikey).toBe('service-secret')
      expect(options.headers.Authorization).toBe('Bearer service-secret')
      return { ok: true, status: 200 }
    })
    const ticks = [1000, 1042]
    const result = await probeDatabaseHealth(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret'
      },
      fetcher,
      { now: () => ticks.shift(), timeoutMs: 1000 }
    )

    expect(result).toEqual({
      ok: true,
      provider: 'supabase',
      status: 'ok',
      latencyMs: 42
    })
    expect(JSON.stringify(result)).not.toContain('service-secret')
    expect(JSON.stringify(result)).not.toContain('example.supabase.co')
  })

  test('fails closed without credentials and never invokes fetch', async () => {
    const fetcher = jest.fn()
    const result = await probeDatabaseHealth({}, fetcher)

    expect(result).toEqual({
      ok: false,
      provider: 'supabase',
      status: 'unconfigured',
      latencyMs: null
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('sanitizes upstream failures', async () => {
    const ticks = [1000, 1015]
    const result = await probeDatabaseHealth(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-secret'
      },
      async () => ({ ok: false, status: 500 }),
      { now: () => ticks.shift() }
    )

    expect(result).toEqual({
      ok: false,
      provider: 'supabase',
      status: 'unhealthy',
      latencyMs: 15
    })
    expect(result).not.toHaveProperty('httpStatus')
    expect(result).not.toHaveProperty('error')
  })

  test('uses a three-second default timeout', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(3000)
  })
})
