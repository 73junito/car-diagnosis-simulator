import { Hono } from 'hono'
import { buildPrompt, extractJson, validateTutorResponse } from '../utils/tutor-response.js'
import { requestOllama } from '../services/ollama.js'
import { requestOpenAI } from '../services/openai-compatible.js'

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

  const prompt = buildPrompt({ scenario, question, studentAnswer, correctAnswer, topic: topic || 'automotive diagnostics' })

  const configuredTimeout = Number.parseInt(c.env.TORQUEMIND_AI_TIMEOUT_MS || '', 10)
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000 ? configuredTimeout : 180000

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
    return c.json(tutorResponse, 200)
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return c.json({ error: 'TorqueMind AI request timed out' }, 504)
    }
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 503)
  } finally {
    clearTimeout(timeout)
  }
}

router.post('/', handleFeedback)

router.all('/', (c) => c.json({ error: 'Method not allowed' }, 405))

export default router
