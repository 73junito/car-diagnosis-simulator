// Curriculum context for scenario pages. Course title is KBOR-listed;
// competency and objectives are AutoLearnPro drafts pending curriculum review.
(function () {
  const electrical = Object.freeze({
    academicLevel: 'undergraduate',
    program: 'Automotive Technology',
    cipCode: '47.0604',
    course: 'Electrical 1',
    competency: 'Use observed electrical symptoms and appropriate measurements to plan a vehicle-specific diagnostic check.',
    learningObjectives: Object.freeze([
      'Identify the role of the battery, alternator, rectifier, and voltage regulation in a charging system.',
      'Interpret a charging warning or low-voltage symptom as a reason to gather further evidence.',
      'Select checks using the vehicle manufacturer’s procedure and specifications.'
    ]),
    alignmentStatus: 'AutoLearnPro draft; course title verified, competency and objectives pending curriculum review',
    programReference: 'https://kansasregents.gov/workforce_development/program-alignment/automotive_technology'
  });
  window.SCENARIO_CURRICULUM = Object.freeze({
    'charging-system': electrical,
    'electrical-load': electrical
  });
})();
