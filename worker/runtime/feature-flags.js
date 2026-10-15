const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value) {
  return TRUE_VALUES.has(text(value).toLowerCase())
}

export const FEATURE_FLAGS = Object.freeze({
  diagnosticCopilot: Object.freeze({
    id: 'diagnostic-copilot',
    envVar: 'TORQUEMIND_COPILOT_ENABLED',
    killSwitchEnvVar: 'TORQUEMIND_COPILOT_KILL_SWITCH',
    governanceLocked: false,
    defaultEnabled: false
  }),
  semanticScholarResearch: Object.freeze({
    id: 'semantic-scholar-research',
    envVar: 'SEMANTIC_SCHOLAR_ENABLED',
    killSwitchEnvVar: null,
    governanceLocked: false,
    defaultEnabled: false
  }),
  assessmentQuestionDisplay: Object.freeze({
    id: 'assessment-question-display',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  }),
  assessmentScoring: Object.freeze({
    id: 'assessment-scoring',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  }),
  institutionalAssessment: Object.freeze({
    id: 'institutional-assessment',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  }),
  highStakesAssessment: Object.freeze({
    id: 'high-stakes-assessment',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  }),
  productionAssessmentRelease: Object.freeze({
    id: 'production-assessment-release',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  }),
  semanticVectorRetrieval: Object.freeze({
    id: 'semantic-vector-retrieval',
    envVar: null,
    killSwitchEnvVar: null,
    governanceLocked: true,
    defaultEnabled: false
  })
})

export function resolveFeatureFlag(flagName, env = {}) {
  const definition = FEATURE_FLAGS[flagName]
  if (!definition) throw new Error(`Unknown feature flag: ${flagName}`)

  if (definition.governanceLocked) {
    return {
      id: definition.id,
      enabled: false,
      configuredEnabled: false,
      killSwitch: false,
      governanceLocked: true,
      reason: 'governance-locked'
    }
  }

  const configuredEnabled = definition.envVar
    ? bool(env[definition.envVar])
    : definition.defaultEnabled
  const killSwitch = definition.killSwitchEnvVar
    ? bool(env[definition.killSwitchEnvVar])
    : false

  return {
    id: definition.id,
    enabled: configuredEnabled && !killSwitch,
    configuredEnabled,
    killSwitch,
    governanceLocked: false,
    reason: !configuredEnabled
      ? 'disabled'
      : killSwitch
        ? 'kill-switch'
        : 'enabled'
  }
}

export function isFeatureEnabled(flagName, env = {}) {
  return resolveFeatureFlag(flagName, env).enabled
}
