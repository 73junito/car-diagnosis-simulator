const DEFAULT_FAULT_INTERACTIONS = Object.freeze({
  battery: Object.freeze({
    affects: Object.freeze({
      starter: Object.freeze({
        symptomShift: 'weak_crank',
        probabilityBoost: 0.2
      })
    })
  }),

  starter: Object.freeze({
    affects: Object.freeze({
      battery: Object.freeze({
        falseIndication: 'low_voltage_reading',
        probabilityBoost: 0.1
      })
    })
  })
});

function clampProbability(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(1, number));
}

function currentProbability(probabilities, fault) {
  return probabilities[fault] || 0.5;
}

function updateFaultProbabilities({
  faultProbabilities,
  faultInteractions = DEFAULT_FAULT_INTERACTIONS,
  component,
  interpretation
} = {}) {
  if (
    !faultProbabilities ||
    typeof faultProbabilities !== 'object'
  ) {
    return faultProbabilities;
  }

  const normalizedComponent = String(component || '');
  const text = String(interpretation || '').toLowerCase();

  switch (normalizedComponent) {
    case 'battery':
      if (
        text.includes('low') ||
        text.includes('problem') ||
        text.includes('<12v')
      ) {
        faultProbabilities.battery =
          currentProbability(
            faultProbabilities,
            'battery'
          ) + 0.25;

        faultProbabilities.starter =
          currentProbability(
            faultProbabilities,
            'starter'
          ) - 0.1;
      }
      break;

    case 'starter':
      faultProbabilities.starter =
        currentProbability(
          faultProbabilities,
          'starter'
        ) + 0.2;
      break;

    case 'fuel':
      if (
        text.includes('no pressure') ||
        text.includes('0 psi')
      ) {
        faultProbabilities.fuel =
          currentProbability(
            faultProbabilities,
            'fuel'
          ) + 0.2;
      }
      break;

    case 'obd':
      faultProbabilities.ecu =
        currentProbability(
          faultProbabilities,
          'ecu'
        ) + 0.15;
      break;

    default:
      break;
  }

  Object.keys(faultInteractions || {}).forEach((fault) => {
    const interaction = faultInteractions[fault];

    if (
      interaction &&
      interaction.affects &&
      interaction.affects[normalizedComponent]
    ) {
      const effect =
        interaction.affects[normalizedComponent];

      faultProbabilities[fault] =
        currentProbability(
          faultProbabilities,
          fault
        ) + Number(effect.probabilityBoost || 0);
    }
  });

  Object.keys(faultProbabilities).forEach((fault) => {
    faultProbabilities[fault] =
      clampProbability(faultProbabilities[fault]);
  });

  return faultProbabilities;
}

class EvidenceEngine {
  constructor({
    faultInteractions = DEFAULT_FAULT_INTERACTIONS
  } = {}) {
    this.faultInteractions = faultInteractions;
  }

  evaluate({
    faultProbabilities,
    component,
    interpretation
  } = {}) {
    return updateFaultProbabilities({
      faultProbabilities,
      faultInteractions: this.faultInteractions,
      component,
      interpretation
    });
  }
}

EvidenceEngine.DEFAULT_FAULT_INTERACTIONS =
  DEFAULT_FAULT_INTERACTIONS;

EvidenceEngine.clampProbability = clampProbability;
EvidenceEngine.updateFaultProbabilities =
  updateFaultProbabilities;

module.exports = EvidenceEngine;
module.exports.DEFAULT_FAULT_INTERACTIONS =
  DEFAULT_FAULT_INTERACTIONS;
module.exports.clampProbability = clampProbability;
module.exports.updateFaultProbabilities =
  updateFaultProbabilities;
