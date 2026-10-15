import {
  isFeatureEnabled,
  resolveFeatureFlag
} from '../worker/runtime/feature-flags.js'
const { verifyFeatureFlagRegistry } = require('../scripts/verify-feature-flag-registry')

describe('governed feature flag registry', () => {
  test('operational flags preserve current environment semantics', () => {
    expect(isFeatureEnabled('diagnosticCopilot', {
      TORQUEMIND_COPILOT_ENABLED: 'true',
      TORQUEMIND_COPILOT_KILL_SWITCH: 'false'
    })).toBe(true)

    expect(isFeatureEnabled('diagnosticCopilot', {
      TORQUEMIND_COPILOT_ENABLED: 'true',
      TORQUEMIND_COPILOT_KILL_SWITCH: 'true'
    })).toBe(false)

    expect(isFeatureEnabled('semanticScholarResearch', {
      SEMANTIC_SCHOLAR_ENABLED: 'true'
    })).toBe(true)
  })

  test.each([
    'assessmentQuestionDisplay',
    'assessmentScoring',
    'institutionalAssessment',
    'highStakesAssessment',
    'productionAssessmentRelease',
    'semanticVectorRetrieval'
  ])('%s cannot be enabled by environment injection', (flagName) => {
    const resolved = resolveFeatureFlag(flagName, {
      ASSESSMENT_ENABLED: 'true',
      QUESTION_DISPLAY_UNLOCK: 'true',
      PRODUCTION_ASSESSMENT_RELEASE: 'true'
    })

    expect(resolved).toMatchObject({
      enabled: false,
      configuredEnabled: false,
      governanceLocked: true,
      reason: 'governance-locked'
    })
  })

  test('checked-in environment states and governance baseline match the registry', () => {
    const result = verifyFeatureFlagRegistry()
    expect(result.operationalCount).toBe(2)
    expect(result.protectedCount).toBe(6)
  })
})
