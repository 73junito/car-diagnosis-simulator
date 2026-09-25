const { findDuplicate } = require('../scripts/lib/question-duplicate-guard');
const retained = require('../data/evidence/review-queues/charging-system-human-review-packet.json').questions;

describe('question duplicate guard', () => {
  test('rejects the actual Ollama smoke draft against the retained rectifier item', () => {
    const generated = {
      question_id: 'charging-system-ai-draft-16b9e63956a4',
      question: 'Which part of an automotive alternator converts the generated alternating current into direct current for the vehicle’s electrical system?',
      options: { A: 'Rotor', B: 'Stator', C: 'Diode rectifier', D: 'Voltage regulator' },
      correct_answer: 'C'
    };
    expect(findDuplicate(generated, retained)).toEqual({
      question_id: '47c057ce-2e41-4ba6-b96e-6c3311417724',
      reason: expect.stringMatching(/stem|answer/)
    });
  });

  test('rejects an identical stem even when the answer position changes', () => {
    const original = retained[0];
    const rewritten = {
      question: original.question,
      options: { A: 'Rotor', B: 'The diode rectifier.', C: 'Stator', D: 'Regulator' },
      correct_answer: 'B'
    };
    expect(findDuplicate(rewritten, retained)?.question_id).toBe(original.question_id);
  });

  test('does not flag a distinct learning target', () => {
    const candidate = {
      question: 'Which measurement would indicate excessive voltage drop on a battery cable under load?',
      options: { A: '0.02 V', B: '0.8 V', C: '12.6 V', D: '14.4 V' },
      correct_answer: 'B'
    };
    expect(findDuplicate(candidate, retained)).toBeNull();
  });
});
