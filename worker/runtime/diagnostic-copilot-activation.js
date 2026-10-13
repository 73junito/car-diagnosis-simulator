import { validateProviderConfig, sanitizeDiagnostics } from '../config/ai-config.js'

const TRUE_VALUES = new Set(['1','true','yes','on'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value) {
  return TRUE_VALUES.has(text(value).toLowerCase())
}

export function resolveDiagnosticCopilotActivation(env = {}) {
  const enabled = bool(env.TORQUEMIND_COPILOT_ENABLED)
  const killSwitch = bool(env.TORQUEMIND_COPILOT_KILL_SWITCH)
  const environment = text(env.TORQUEMIND_ENVIRONMENT) || 'unknown'
  const persistenceMode = text(env.TORQUEMIND_ORCHESTRATION_PERSISTENCE) || 'disabled'
  const persistenceExpectedRef = text(env.TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF)
  const url = text(env.SUPABASE_URL)
  let actualRef = ''
  try {
    actualRef = new URL(url).hostname.replace(/\.supabase\.co$/,'')
  } catch {}

  const persistenceHealthy =
    persistenceMode === 'supabase' &&
    Boolean(actualRef) &&
    (!persistenceExpectedRef || persistenceExpectedRef === actualRef)

  if (!enabled || killSwitch || !persistenceHealthy) {
    return {
      enabled: false,
      configuredEnabled: enabled,
      killSwitch,
      environment,
      persistenceHealthy,
      provider: null,
      reason: !enabled
        ? 'disabled'
        : killSwitch
          ? 'kill-switch'
          : 'persistence-unhealthy'
    }
  }

  const provider = text(env.TORQUEMIND_AI_PROVIDER) || 'ollama'
  const model = text(env.TORQUEMIND_AI_MODEL) || 'unknown'
  const providerUrl = text(env.TORQUEMIND_AI_URL)

  const validated = validateProviderConfig({
    provider,
    url: providerUrl,
    apiKey: text(env.TORQUEMIND_AI_API_KEY),
    env: { ...env, NODE_ENV: environment === 'production' ? 'production' : env.NODE_ENV }
  })

  return {
    enabled: true,
    configuredEnabled: true,
    killSwitch: false,
    environment,
    persistenceHealthy: true,
    provider: sanitizeDiagnostics({
      provider: validated.provider,
      model,
      host: validated.host
    }),
    reason: 'ready'
  }
}
