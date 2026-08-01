export async function requestOpenAI({ url, model, prompt, apiKey, signal }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are TorqueMind, an automotive diagnostic tutor. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })

  const text = await res.text()

  if (!res.ok) {
    const truncated = String(text).slice(0, 300)
    throw new Error(`OpenAI-compatible returned ${res.status}: ${truncated}`)
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch (err) {
    throw new Error('OpenAI-compatible returned invalid JSON')
  }

  const content =
    (payload && Array.isArray(payload.choices) && payload.choices[0] &&
      ((payload.choices[0].message && typeof payload.choices[0].message.content === 'string' && payload.choices[0].message.content.trim()) ||
        (typeof payload.choices[0].text === 'string' && payload.choices[0].text.trim()))) ||
    ''

  if (!content) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('OpenAI-compatible returned payload with no usable content', JSON.stringify(payload).slice(0, 2000))
    }
    throw new Error('OpenAI-compatible returned no tutor content')
  }

  return content
}

export default { requestOpenAI }
export async function requestOpenAICompatible({ url, apiKey, model, prompt, signal }) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are TorqueMind, an automotive diagnostic tutor.' },
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`AI provider returned ${resp.status}: ${text.slice(0, 300)}`)
  }

  const text = await resp.text()
  // For OpenAI-compatible providers the content may be nested; return the raw text for parser
  return text
}
