import { Hono } from 'hono'

const router = new Hono()

router.post('/', async (c) => {
  let body
  try {
    body = await c.req.json()
  } catch (err) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { scenario, question, studentAnswer, correctAnswer } = body

  if (!scenario || !question || !studentAnswer || !correctAnswer) {
    return c.json({ error: 'scenario, question, studentAnswer, and correctAnswer are required' }, 400)
  }

  // Use Cloudflare Worker env via c.env
  const provider = c.env.TORQUEMIND_AI_PROVIDER || 'ollama'
  const model = c.env.TORQUEMIND_AI_MODEL || 'qwen3.5:latest'
  const url = c.env.TORQUEMIND_AI_URL || 'http://127.0.0.1:11434/api/chat'

  // Placeholder response for Commit 1 — provider integration will follow in later commits
  return c.json({ error: 'TorqueMind AI provider is not connected' }, 503)
})

router.all('/', (c) => c.json({ error: 'Method not allowed' }, 405))

export default router
