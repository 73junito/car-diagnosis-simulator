export const ALLOWED_PROVIDERS = ['ollama', 'openai-compatible']

export const DEFAULTS = {
  MIN_TIMEOUT_MS: 1000,
  MAX_TIMEOUT_MS: 600000, // 10 minutes
  DEFAULT_TIMEOUT_MS: 180000,
}

export function isProduction(env = {}) {
  const node = (env.NODE_ENV || '').toLowerCase()
  return node === 'production'
}

export function isLocalOrLoopback(hostname) {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  if (h === 'localhost') return true
  if (h === '0.0.0.0') return true
  if (h.startsWith('127.')) return true
  return false
}

export function isPrivateRFC1918(hostname) {
  if (!hostname) return false
  // quick check for IPv4 private ranges
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true
  return false
}

export function validateProviderConfig({ provider, url, apiKey, env = {} }) {
  // Only enforce strict provider allowlist in production
  if (isProduction(env) && !ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`)
  }

  let hostname
  try {
    const u = new URL(url)
    hostname = u.hostname
  } catch (err) {
    // if url is not a full URL, allow hostnames like 'ollama' for local dev only
    hostname = url
  }

  if (isProduction(env)) {
    if (isLocalOrLoopback(hostname) || isPrivateRFC1918(hostname)) {
      throw new Error('Refusing to use localhost or private-network AI providers in production')
    }
    if (provider === 'openai-compatible' && (!apiKey || apiKey.length < 8)) {
      throw new Error('Missing required API key for openai-compatible provider in production')
    }
  }

  // When using a non-loopback Ollama host (e.g., tunneled hostname), enforce Access credential pairing:
  // If either access credential is present in the environment for non-loopback hosts, require both.
  const accessId = env.OLLAMA_ACCESS_CLIENT_ID || ''
  const accessSecret = env.OLLAMA_ACCESS_CLIENT_SECRET || ''
  if (!isLocalOrLoopback(hostname) && (accessId || accessSecret)) {
    if (!accessId || !accessSecret) {
      throw new Error('When using Cloudflare Access for Ollama, both OLLAMA_ACCESS_CLIENT_ID and OLLAMA_ACCESS_CLIENT_SECRET must be set')
    }
  }

  return {
    provider,
    host: hostname,
    model: env.TORQUEMIND_AI_MODEL || env.TORQUEMIND_AI_MODEL_DEFAULT || 'unknown',
  }
}

export function sanitizeDiagnostics(diag) {
  // Return only safe metadata — provider, model, host
  return {
    provider: diag.provider,
    model: diag.model,
    host: diag.host,
  }
}
