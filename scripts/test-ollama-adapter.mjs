import { requestOllama } from '../worker/services/ollama.js'

if (!process.env.TORQUEMIND_AI_API_KEY) {
  console.error('Set TORQUEMIND_AI_API_KEY in the environment before running this script')
  process.exit(2)
}

try {
  const res = await requestOllama({
    url: 'https://ollama.com/api/chat',
    model: 'gpt-oss:20b-cloud',
    prompt: 'Reply only with {"status":"ok"}',
    apiKey: process.env.TORQUEMIND_AI_API_KEY,
    timeoutMs: 60000
  })
  // print safe SHA-256 of the key for comparison with remote logs
  try {
    const { createHash } = await import('crypto')
    const h = createHash('sha256').update(process.env.TORQUEMIND_AI_API_KEY, 'utf8').digest('hex')
    console.log('Local keyHash:', h)
  } catch (e) {
    // ignore
  }

  console.log('Adapter call succeeded, response content:')
  console.log(res)
} catch (err) {
  console.error('Adapter call failed:')
  console.error(err && err.message ? err.message : err)
  if (err && typeof err.status === 'number') {
    console.error('Upstream status:', err.status)
  }
  process.exit(1)
}
