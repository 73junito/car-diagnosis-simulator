const DEFAULT_TIMEOUT_MS = 3000

function safeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function emitProbe(result) {
  console.log(JSON.stringify({
    event: 'autolearnpro.database.probe',
    provider: 'supabase',
    ok: result.ok,
    status: result.status,
    latencyMs: result.latencyMs
  }))
}

export async function probeDatabaseHealth(env = {}, fetcher = fetch, options = {}) {
  const supabaseUrl = safeText(env.SUPABASE_URL)
  const serviceRoleKey = safeText(env.SUPABASE_SERVICE_ROLE_KEY)
  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : DEFAULT_TIMEOUT_MS
  const now = typeof options.now === 'function' ? options.now : Date.now

  if (!supabaseUrl || !serviceRoleKey) {
    const result = {
      ok: false,
      provider: 'supabase',
      status: 'unconfigured',
      latencyMs: null
    }
    emitProbe(result)
    return result
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = now()

  try {
    const response = await fetcher(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/curriculum_lesson_plans?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      }
    )

    const latencyMs = Math.max(0, now() - started)
    const result = {
      ok: Boolean(response?.ok),
      provider: 'supabase',
      status: response?.ok ? 'ok' : 'unhealthy',
      latencyMs
    }
    emitProbe(result)
    return result
  } catch (error) {
    const latencyMs = Math.max(0, now() - started)
    const result = {
      ok: false,
      provider: 'supabase',
      status: error?.name === 'AbortError' ? 'timeout' : 'unreachable',
      latencyMs
    }
    emitProbe(result)
    return result
  } finally {
    clearTimeout(timer)
  }
}

export { DEFAULT_TIMEOUT_MS }
