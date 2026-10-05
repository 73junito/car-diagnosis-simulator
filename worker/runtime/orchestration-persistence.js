import persistenceRuntime from '../../src/ai/runtime/production-persistence-runtime.js'

const { resolveProductionPersistenceConfig } = persistenceRuntime

export function orchestrationPersistenceHealth(env = {}) {
  try {
    const config = resolveProductionPersistenceConfig(env)
    return {
      ok: true,
      enabled: config.enabled,
      mode: config.mode,
      projectRef: config.projectRef,
      credentialSource: config.credentialSource
    }
  } catch (error) {
    return {
      ok: false,
      enabled: false,
      mode: env.TORQUEMIND_ORCHESTRATION_PERSISTENCE || 'disabled',
      projectRef: null,
      credentialSource: null,
      error: error instanceof Error ? error.message : 'configuration_invalid'
    }
  }
}
