export async function requestOllama({ url, model, prompt, signal }) {
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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })

  const text = await res.text()

  if (!res.ok) {
    const truncated = String(text).slice(0, 300)
    throw new Error(`Ollama returned ${res.status}: ${truncated}`)
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
      // eslint-disable-next-line no-console
      console.error('Ollama returned payload with no usable content', JSON.stringify(payload).slice(0, 2000))
    }
    throw new Error('Ollama returned no tutor content')
  }

  return content
}
export default { requestOllama }

