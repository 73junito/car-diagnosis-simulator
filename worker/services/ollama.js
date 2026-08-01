export async function requestOllama({ url, model, prompt, apiKey, signal, timeoutMs }) {
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
  // normalize API key defensively: trim and strip any accidental "Bearer " prefix
  const rawKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey : (typeof process !== 'undefined' && process.env && process.env.TORQUEMIND_AI_API_KEY ? process.env.TORQUEMIND_AI_API_KEY : '')
  const normalizedApiKey = typeof rawKey === 'string' ? rawKey.trim().replace(/^Bearer\s+/i, '') : ''

  const headers = { 'Content-Type': 'application/json' }
  if (normalizedApiKey) {
    headers.authorization = `Bearer ${normalizedApiKey}`
  }

  // Emit safe debug flags (no secret values)
  try {
    // compute SHA-256 hash of the normalized key for safe comparison (no secrets logged)
    let keyHash = null
    if (normalizedApiKey) {
      try {
        const enc = new TextEncoder()
        const data = enc.encode(normalizedApiKey)
        const digest = await crypto.subtle.digest('SHA-256', data)
        const arr = Array.from(new Uint8Array(digest))
        keyHash = arr.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch (hf) {
        keyHash = null
      }
    }

    console.log(JSON.stringify({
      event: 'torquemind.feedback.adapter',
      hasApiKey: Boolean(normalizedApiKey),
      authHeaderPresent: Boolean(headers.authorization),
      authHeaderStartsWithBearer: typeof headers.authorization === 'string' ? headers.authorization.startsWith('Bearer ') : false,
      keyHash
    }))
  } catch (e) {
    // swallow logging errors
  }

  const fetchOpts = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  }

  const res = await fetch(url, fetchOpts)

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

