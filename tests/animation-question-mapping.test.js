import fs from 'fs'
import path from 'path'
import {
  STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS,
  resolveQuestionAnimationMapping,
} from '../animation/question-mapping/starting-system-question-animation-map.js'

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

describe('ANIM-2G approved-question to animation mapping', () => {
  test('maps a governed ground-resistance question to the canonical engineering fault and instructional clip', () => {
    const mapping = resolveQuestionAnimationMapping({
      question_id: 'no-crank-ground-resistance-01',
      scenario_id: 'no-crank',
    })

    expect(mapping).toMatchObject({
      mappingId: 'starting-ground-resistance',
      scenarioId: 'no-crank',
      engineering: {
        artifactRef: 'data/circuit-templates/12v-starting-system.json',
        operatingStateId: 'crank',
        faultId: 'FAULT_HIGH_RES_GROUND',
        componentIds: ['MTR1', 'GND1'],
        connectionIds: ['W_MOTOR_GND'],
      },
      presentation: {
        animationId: 'starting-system-voltage-drop-review',
        clipId: 'select-measurement-path',
        publicationState: 'review-only',
      },
      authority: {
        questionProvidesInstructionalContextOnly: true,
        engineeringArtifactDeterminesElectricalBehavior: true,
        presentationMappingDeterminesVisualSelectionOnly: true,
        databaseMayOverrideEngineeringBehavior: false,
        assessmentEligibilityEffect: 'none',
        publicationEffect: 'none',
      },
    })
  })

  test('uses exact stable question_id and matching scenario_id only', () => {
    expect(resolveQuestionAnimationMapping({
      question_id: 'unknown-question',
      scenario_id: 'no-crank',
    })).toBeNull()

    expect(resolveQuestionAnimationMapping({
      question_id: 'no-crank-ground-resistance-01',
      scenario_id: 'charging-system',
    })).toBeNull()

    expect(resolveQuestionAnimationMapping({
      id: 'database-uuid-only',
      scenario_id: 'no-crank',
    })).toBeNull()
  })

  test('does not encode calculations, resistance values, voltage thresholds, scoring, or answer keys', () => {
    const serialized = JSON.stringify(STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS)
    expect(serialized).not.toMatch(/correct_answer|score|points|ohm|resistanceValue|voltageThreshold|passFail/i)
  })

  test('keeps every current mapping review-only', () => {
    for (const mapping of Object.values(STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS)) {
      expect(mapping.presentation.publicationState).toBe('review-only')
    }
  })

  test('attaches mappings only through governed approved-question API surfaces', () => {
    for (const route of [
      'worker/routes/scenario-questions-approved.js',
      'api/scenario-questions-approved.js',
    ]) {
      const source = read(route)
      expect(source).toContain('resolveQuestionAnimationMapping')
      expect(source).toContain('animation_mapping: resolveQuestionAnimationMapping(question)')
      expect(source).toMatch(/question_provenance[\s\S]*status.*approved|\.eq\('status', 'approved'\)/)
    }

    const assessmentRoute = read('worker/routes/assessment-attempt-questions.js')
    expect(assessmentRoute).not.toContain('resolveQuestionAnimationMapping')
    expect(assessmentRoute).not.toContain('animation_mapping:')
  })
})
