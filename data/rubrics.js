(function(){
  // Default rubrics per scenario
  window.rubrics = window.rubrics || {};

  window.rubrics['default'] = {
    weights: { symptom:0.25, tests:0.25, diagnosis:0.4, safety:0.1 },
    threshold: 70,
    criteria: { expectedDiagnosis: '', expectedTests: [], symptomKeywords: [], safetyTestName: null }
  };

  window.rubrics['no-start'] = {
    weights: { symptom:0.25, tests:0.25, diagnosis:0.4, safety:0.1 },
    threshold: 70,
    criteria: {
      expectedDiagnosis: 'starter fault',
      expectedTests: ['OBD Scan','Battery Test'],
      symptomKeywords: ['no crank','no start','clicking'],
      safetyTestName: 'Battery Test'
    }
  };

  window.rubrics['hybrid-ev'] = {
    weights: { symptom:0.2, tests:0.3, diagnosis:0.4, safety:0.1 },
    threshold: 75,
    criteria: {
      expectedDiagnosis: 'hybrid inverter fault',
      expectedTests: ['OBD Scan','High Voltage Check'],
      symptomKeywords: ['loss of power','hybrid','ev'],
      safetyTestName: 'High Voltage Check'
    }
  };
})();
