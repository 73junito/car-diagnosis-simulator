const { validateGenerated } =
  require('../scripts/lib/scenario-challenge-validator');

const plan = { scenario_banks: ['no-crank', 'no-start'] };
const batch = {
  target_count: 2,
  allocation: { 'no-crank': 1, 'no-start': 1 }
};

function item(overrides = {}) {
  return {
    scenario_id: 'no-crank',
    difficulty: 'intermediate',
    question: 'Which diagnostic result most directly changes the next step in this no-crank scenario?',
    options: {
      A: 'Result A',
      B: 'Result B',
      C: 'Result C',
      D: 'Result D'
    },
    correct_answer: 'A',
    explanation: 'The selected result directly determines the next diagnostic branch.',
    challenge_pattern: 'next-best diagnostic step',
    claims_to_verify: ['The keyed result determines the stated next diagnostic branch.'],
    support_status: 'synthetic-draft-pending-evidence',
    status: 'draft',
    eligible_for_training_mix: false,
    eligible_for_scoring: false,
    assessment_eligible: false,
    ...overrides
  };
}

function validDoc() {
  return {
    questions: [
      item(),
      item({
        scenario_id: 'no-start',
        question: 'Which test finding most directly separates a crank-no-start fuel fault from an ignition fault?'
      })
    ]
  };
}

describe('scenario challenge validator', () => {
  test('accepts a complete batch and stamps all fail-closed review fields', () => {
    const result = validateGenerated({ doc: validDoc(), plan, batch });
    expect(result).toHaveLength(2);
    for (const draft of result) {
      expect(draft.synthetic_draft_id).toMatch(/-challenge-[a-f0-9]{12}$/);
      expect(draft.human_technical_review_completed).toBe(false);
      expect(draft.human_instructional_review_completed).toBe(false);
      expect(draft.evidence_mapping_completed).toBe(false);
      expect(draft.citation_validation_completed).toBe(false);
      expect(draft.approved).toBe(false);
    }
  });

  test('rejects duplicate option text after normalization', () => {
    const doc = validDoc();
    doc.questions[0].options.D = '  RESULT A  ';
    expect(() => validateGenerated({ doc, plan, batch }))
      .toThrow('Question 1 repeats answer option text.');
  });

  test.each([
    ['blank claim', (q) => { q.claims_to_verify = ['']; }, 'must declare non-blank claims_to_verify'],
    ['null claim', (q) => { q.claims_to_verify = [null]; }, 'must declare non-blank claims_to_verify'],
    ['missing explanation', (q) => { q.explanation = ''; }, 'is missing an explanation'],
    ['missing challenge pattern', (q) => { q.challenge_pattern = ''; }, 'is missing challenge_pattern'],
    ['invalid difficulty', (q) => { q.difficulty = 'beginner'; }, 'has invalid difficulty']
  ])('rejects schema-incomplete output: %s', (_name, mutate, expected) => {
    const doc = validDoc();
    mutate(doc.questions[0]);
    expect(() => validateGenerated({ doc, plan, batch })).toThrow(expected);
  });

  test('rejects scenario allocation mismatches', () => {
    const doc = validDoc();
    doc.questions[1].scenario_id = 'no-crank';
    doc.questions[1].question = 'Which second no-crank finding should be verified before replacing a starter motor?';
    expect(() => validateGenerated({ doc, plan, batch }))
      .toThrow('Scenario no-crank expected 1 questions; received 2.');
  });

  test('rejects model attempts to opt synthetic drafts into delivery or scoring', () => {
    for (const field of ['eligible_for_training_mix', 'eligible_for_scoring', 'assessment_eligible']) {
      const doc = validDoc();
      doc.questions[0][field] = true;
      expect(() => validateGenerated({ doc, plan, batch }))
        .toThrow('Question 1 violates draft governance.');
    }
  });
});
