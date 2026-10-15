export const STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS = Object.freeze({
  "no-crank-voltage-drop-01": Object.freeze({
    mappingId: "starting-voltage-drop-purpose",
    scenarioId: "no-crank",
    engineering: Object.freeze({
      artifactRef: "data/circuit-templates/12v-starting-system.json",
      operatingStateId: "crank",
      faultId: null,
      componentIds: Object.freeze(["BAT1", "SOL_CONTACT", "MTR1", "GND1"]),
      connectionIds: Object.freeze(["W_BAT_CONTACT", "W_CONTACT_MOTOR", "W_MOTOR_GND", "W_BAT_GND"])
    }),
    presentation: Object.freeze({
      animationId: "starting-system-voltage-drop-review",
      clipId: "select-measurement-path",
      publicationState: "review-only"
    })
  }),
  "no-crank-ground-resistance-01": Object.freeze({
    mappingId: "starting-ground-resistance",
    scenarioId: "no-crank",
    engineering: Object.freeze({
      artifactRef: "data/circuit-templates/12v-starting-system.json",
      operatingStateId: "crank",
      faultId: "FAULT_HIGH_RES_GROUND",
      componentIds: Object.freeze(["MTR1", "GND1"]),
      connectionIds: Object.freeze(["W_MOTOR_GND"])
    }),
    presentation: Object.freeze({
      animationId: "starting-system-voltage-drop-review",
      clipId: "select-measurement-path",
      publicationState: "review-only"
    })
  }),
  "no-crank-ignition-switch-01": Object.freeze({
    mappingId: "starting-control-open",
    scenarioId: "no-crank",
    engineering: Object.freeze({
      artifactRef: "data/circuit-templates/12v-starting-system.json",
      operatingStateId: "crank",
      faultId: "FAULT_OPEN_CONTROL",
      componentIds: Object.freeze(["SW1", "SOL_COIL"]),
      connectionIds: Object.freeze(["W_SWITCH_SOL"])
    }),
    presentation: Object.freeze({
      animationId: "starting-system-voltage-drop-review",
      clipId: "identify-control-path",
      publicationState: "review-only"
    })
  }),
  "no-crank-starter-current-01": Object.freeze({
    mappingId: "starting-current-path",
    scenarioId: "no-crank",
    engineering: Object.freeze({
      artifactRef: "data/circuit-templates/12v-starting-system.json",
      operatingStateId: "crank",
      faultId: null,
      componentIds: Object.freeze(["BAT1", "SOL_CONTACT", "MTR1", "GND1"]),
      connectionIds: Object.freeze(["W_BAT_CONTACT", "W_CONTACT_MOTOR", "W_MOTOR_GND", "W_BAT_GND"])
    }),
    presentation: Object.freeze({
      animationId: "starting-system-voltage-drop-review",
      clipId: "identify-current-path",
      publicationState: "review-only"
    })
  })
})

function cloneMapping(mapping) {
  return mapping ? JSON.parse(JSON.stringify(mapping)) : null
}

export function resolveQuestionAnimationMapping(question) {
  if (!question || typeof question !== "object") return null
  const questionId = typeof question.question_id === "string" ? question.question_id : ""
  const scenarioId = typeof question.scenario_id === "string" ? question.scenario_id : ""
  if (!questionId || !scenarioId) return null

  const mapping = STARTING_SYSTEM_QUESTION_ANIMATION_MAPPINGS[questionId]
  if (!mapping || mapping.scenarioId !== scenarioId) return null

  return cloneMapping({
    ...mapping,
    source: {
      kind: "approved-database-question",
      questionId,
      scenarioId
    },
    authority: {
      questionProvidesInstructionalContextOnly: true,
      engineeringArtifactDeterminesElectricalBehavior: true,
      presentationMappingDeterminesVisualSelectionOnly: true,
      databaseMayOverrideEngineeringBehavior: false,
      assessmentEligibilityEffect: "none",
      publicationEffect: "none"
    }
  })
}
