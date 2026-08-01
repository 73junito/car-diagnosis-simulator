export async function requestOllama({ url, model, prompt, apiKey, signal }) {
  const body = {
    model,
    stream: false,
    think: false,
    messages: [
      { role: 'system', content: 'You are TorqueMind, an automotive diagnostic tutor. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    options: {
      temperature: 0.2,
      num_predict: 220
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    headers.authorization = `Bearer ${apiKey}`
  } else if (typeof process !== 'undefined' && process.env && process.env.TORQUEMIND_AI_API_KEY) {
    headers.authorization = `Bearer ${process.env.TORQUEMIND_AI_API_KEY}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })

  const text = await res.text()

  if (!res.ok) {
    const truncated = String(text).slice(0, 300)
    const e = new Error(`Ollama returned ${res.status}`)
    // attach numeric status for safe logging without including provider body
    e.status = Number(res.status)
    throw e
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch (err) {
    throw new Error('Ollama returned invalid JSON')
  }

  const content =
    (payload && payload.message && typeof payload.message.content === 'string' && payload.message.content.trim()) ||
    (payload && payload.message && typeof payload.message.thinking === 'string' && payload.message.thinking.trim()) ||
    (payload && typeof payload.response === 'string' && payload.response.trim()) ||
    (payload && typeof payload.thinking === 'string' && payload.thinking.trim()) ||
    ''

  if (!content) {
    // Avoid logging full payload in production
    if (process.env.NODE_ENV === 'development') {
        console.error('Ollama returned payload with no usable content', JSON.stringify(payload).slice(0, 2000))
    }
    throw new Error('Ollama returned no tutor content')
  }

  return content
}
export default { requestOllama }

