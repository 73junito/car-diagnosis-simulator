import { Hono } from 'hono'
import { buildPrompt, extractJson, validateTutorResponse } from '../utils/tutor-response.js'
import { requestOllama } from '../services/ollama.js'
import { requestOpenAI } from '../services/openai-compatible.js'
import { validateProviderConfig, sanitizeDiagnostics, DEFAULTS } from '../config/ai-config.js'
import { logRequestStart, logRequestCompleted, logRequestFailed } from '../utils/logger.js'

const router = new Hono()

export async function handleFeedback(c) {
  let body
  try {
    if (c.req && typeof c.req.json === 'function') {
      body = await c.req.json()
    } else if (c.req && typeof c.req.text === 'function') {
      const t = await c.req.text()
      body = t ? JSON.parse(t) : undefined
    } else if (c.req && typeof c.req.body === 'string') {
      body = JSON.parse(c.req.body)
    } else {
      throw new Error('Invalid JSON body')
    }
  } catch (err) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { scenario, question, studentAnswer, correctAnswer, topic } = body

  if (!scenario || !question || !studentAnswer || !correctAnswer) {
    return c.json({ error: 'scenario, question, studentAnswer, and correctAnswer are required' }, 400)
  }

  const provider = c.env.TORQUEMIND_AI_PROVIDER || 'ollama'
  const model = c.env.TORQUEMIND_AI_MODEL || 'qwen3.5:latest'
  const url = c.env.TORQUEMIND_AI_URL || 'http://127.0.0.1:11434/api/chat'
  const apiKey = c.env.TORQUEMIND_AI_API_KEY || ''

  // validate provider configuration for production safety
  let diag
  try {
    diag = validateProviderConfig({ provider, url, apiKey, env: c.env })
    // safe diagnostics only; attach when platform provides `c.set`
    const safeDiag = sanitizeDiagnostics({ provider: diag.provider, model: diag.model, host: diag.host })
    if (typeof c.set === 'function') {
      c.set('ai_diag', safeDiag)
    } else {
      // attach to env for local/test visibility without mutating platform context
      c.env = Object.assign({}, c.env, { TORQUE_AI_DIAG: safeDiag })
    }
  } catch (err) {
    // log configuration rejection
    const rid = c.reqId || (c.req && c.reqId) || null
    logRequestFailed({ requestId: rid, status: 400, errorType: 'configuration_error', provider, model, providerHost: url })
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
  }

  // observability: start
  const requestId = c.reqId || (c.req && c.reqId) || null
  logRequestStart({ requestId, method: c.req?.method || 'POST', route: '/api/torquemind-feedback', provider: diag.provider, model: diag.model, providerHost: diag.host })
  const prompt = buildPrompt({ scenario, question, studentAnswer, correctAnswer, topic: topic || 'automotive diagnostics' })

  const configuredTimeout = Number.parseInt(c.env.TORQUEMIND_AI_TIMEOUT_MS || '', 10)
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, DEFAULTS.MIN_TIMEOUT_MS), DEFAULTS.MAX_TIMEOUT_MS)
    : DEFAULTS.DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
    let rawResponse
    if (provider === 'ollama') {
      rawResponse = await requestOllama({ url, model, prompt, signal: controller.signal })
    } else if (provider === 'openai-compatible') {
      const apiKey = c.env.TORQUEMIND_AI_API_KEY || ''
      rawResponse = await requestOpenAI({ url, model, prompt, apiKey, signal: controller.signal })
    } else {
      return c.json({ error: `Unsupported AI provider: ${provider}` }, 503)
    }

    const parsed = extractJson(rawResponse)
    const tutorResponse = validateTutorResponse(parsed)
    const duration = typeof c.get === 'function' ? c.get('req_duration_ms') : (c.env && c.env.TORQUE_AI_DIAG && c.env.TORQUE_AI_DIAG.durationMs) || 0
    logRequestCompleted({ requestId, method: c.req?.method || 'POST', route: '/api/torquemind-feedback', status: 200, durationMs: duration, provider: diag.provider, model: diag.model, providerHost: diag.host })
    // include request id in response header (already set by middleware) and return payload
    return c.json(tutorResponse, 200)
  } catch (err) {
    const rid = requestId
    if (err && err.name === 'AbortError') {
      logRequestFailed({ requestId: rid, status: 504, errorType: 'timeout', provider: diag.provider, model: diag.model, providerHost: diag.host })
      return c.json({ error: 'TorqueMind AI request timed out' }, 504)
    }
    // categorize errors conservatively
    logRequestFailed({ requestId: rid, status: 503, errorType: 'provider_error', provider: diag.provider, model: diag.model, providerHost: diag.host })
    return c.json({ error: 'TorqueMind AI provider error' }, 503)
  } finally {
    clearTimeout(timeout)
  }
}

router.post('/', handleFeedback)

router.all('/', (c) => c.json({ error: 'Method not allowed' }, 405))

export default router
