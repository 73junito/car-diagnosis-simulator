import { Hono } from 'hono'
import { buildPrompt, extractJson, normalizeTutorResponse } from '../utils/tutor-response.js'
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

  const { scenario, question, studentAnswer, topic, delivery_mode, ai_assistance_allowed } = body

  // GUARDRAIL: Assessment mode must reject tutor requests BEFORE any provider access
  if (delivery_mode === 'independent_non_proctored_assessment' || ai_assistance_allowed === false) {
    return c.json({
      error: "AI assistance is not available during official assessment",
      code: "assessment_mode_tutor_disabled"
    }, 403)
  }

  if (!scenario || !question || !studentAnswer) {
    return c.json({ error: 'scenario, question, and studentAnswer are required' }, 400)
  }

  // NOTE: correctAnswer is NEVER accepted from client request
  // Assessment grading is server-side only via /api/scenario-submissions/grade
  // This prevents answer-key exposure through the AI prompt

  const provider = c.env.TORQUEMIND_AI_PROVIDER || 'ollama'
  const model = c.env.TORQUEMIND_AI_MODEL || 'gpt-oss:20b'
  const url = c.env.TORQUEMIND_AI_URL || 'http://127.0.0.1:11434/api/chat'
  const apiKey = c.env.TORQUEMIND_AI_API_KEY || ''
  const accessClientId = c.env.OLLAMA_ACCESS_CLIENT_ID || ''
  const accessClientSecret = c.env.OLLAMA_ACCESS_CLIENT_SECRET || ''

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
  const prompt = buildPrompt({
    scenario,
    question,
    studentAnswer,
    topic: topic || 'automotive diagnostics'
  })

  const configuredTimeout = Number.parseInt(c.env.TORQUEMIND_AI_TIMEOUT_MS || '', 10)
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, DEFAULTS.MIN_TIMEOUT_MS), DEFAULTS.MAX_TIMEOUT_MS)
    : DEFAULTS.DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
    let rawResponse
    if (provider === 'ollama') {
      rawResponse = await requestOllama({ url, model, prompt, apiKey: apiKey, accessClientId, accessClientSecret, signal: controller.signal })
    } else if (provider === 'openai-compatible') {
      const apiKey = c.env.TORQUEMIND_AI_API_KEY || ''
      rawResponse = await requestOpenAI({ url, model, prompt, apiKey, signal: controller.signal })
    } else {
      return c.json({ error: `Unsupported AI provider: ${provider}` }, 503)
    }

    let parsed = {}
    try {
      parsed = extractJson(rawResponse)
    } catch (err) {
      parsed = {}
    }
    const tutorResponse = normalizeTutorResponse(parsed, rawResponse)
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
    // categorize errors conservatively, record upstream numeric status when available
    const upstreamStatus = err && typeof err.status === 'number' ? Number(err.status) : undefined
    if (upstreamStatus === undefined) {
      const fallbackResponse = normalizeTutorResponse({}, '')
      return c.json(fallbackResponse, 200)
    }
    logRequestFailed({ requestId: rid, status: 503, errorType: 'provider_error', provider: diag.provider, model: diag.model, providerHost: diag.host, upstreamStatus })
    return c.json({ error: 'TorqueMind AI provider error' }, 503)
  } finally {
    clearTimeout(timeout)
  }
}

router.post('/', handleFeedback)

router.all('/', (c) => c.json({ error: 'Method not allowed' }, 405))

export default router
