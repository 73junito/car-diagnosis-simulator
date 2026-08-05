export async function requestOllama({ url, model, prompt, apiKey, accessClientId, accessClientSecret, signal, timeoutMs }) {
  const body = {
    model,
    stream: false,
    think: false,
    format: 'json',
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
  const rawKey = typeof apiKey === 'string' && apiKey.trim()
    ? apiKey
    : (typeof process !== 'undefined' && process.env && process.env.TORQUEMIND_AI_API_KEY ? process.env.TORQUEMIND_AI_API_KEY : '')
  const normalizedApiKey = typeof rawKey === 'string' ? rawKey.trim().replace(/^Bearer\s+/i, '') : ''

  // Access credentials may be provided as params (Worker bindings forwarded from route),
  // or available in process.env for local/test runs.
  const accessId = accessClientId || (typeof process !== 'undefined' && process.env && process.env.OLLAMA_ACCESS_CLIENT_ID ? process.env.OLLAMA_ACCESS_CLIENT_ID : '')
  const accessSecret = accessClientSecret || (typeof process !== 'undefined' && process.env && process.env.OLLAMA_ACCESS_CLIENT_SECRET ? process.env.OLLAMA_ACCESS_CLIENT_SECRET : '')

  const headers = { 'Content-Type': 'application/json' }

  // Prefer Cloudflare Access service token when both client id + secret present
  if (accessId && accessSecret) {
    headers['CF-Access-Client-Id'] = accessId
    headers['CF-Access-Client-Secret'] = accessSecret
  } else if (normalizedApiKey) {
    headers.authorization = `Bearer ${normalizedApiKey}`
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
    // Surface only numeric status to avoid leaking provider payloads or secrets
    const e = new Error(`Ollama returned ${res.status}`)
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
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      try {
        console.error('Ollama returned payload with no usable content', JSON.stringify(payload).slice(0, 2000))
      } catch (e) {
        // ignore stringify errors
      }
    }
    throw new Error('Ollama returned no tutor content')
  }

  return content
}

export default { requestOllama }

