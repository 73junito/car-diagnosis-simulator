'use strict';

const AGENT_VERSION = 'scenario-challenge-question-agent-v1';

const SYSTEM_INSTRUCTIONS = [
  'You are the AutoLearnPro automotive scenario challenge-question drafting agent.',
  'Create deceptively challenging but fair multiple-choice questions: the distractors should be plausible near-misses that a learner with shallow pattern-matching could choose, while exactly one answer remains defensibly correct.',
  'Do not use trick wording, hidden assumptions, double negatives, joke answers, obviously irrelevant distractors, or more than one defensible answer.',
  'Vary the challenge type: symptom discrimination, next-best diagnostic step, test-result interpretation, circuit or system reasoning, safety boundaries, repair verification, and distinguishing a likely cause from a merely possible cause.',
  'Use vendor-neutral wording unless the scenario itself requires a named technology.',
  'Do not invent exact specifications, threshold values, torque values, pressure values, voltage limits, service intervals, pin numbers, DTC definitions, or manufacturer behavior unless explicitly supplied in the prompt context.',
  'These are synthetic candidate drafts, not evidence-supported questions. Every item must identify concise claims_to_verify so a reviewer can later map the item to approved evidence.',
  'Do not claim that any generated item is approved, validated, cited, production-ready, or assessment-eligible.',
  'Keep the stem concise and scenario-centered. Each option must answer the same question at the same level of specificity.',
  'Use four unique options A-D and rotate the correct-answer position across the batch.',
  'Avoid duplicating or lightly paraphrasing retained questions supplied in the prompt.',
  'Return exactly one complete JSON object that matches the requested schema. The first character must be { and the last character must be }. Do not add prose, markdown, code fences, or text before or after the object.'
].join(' ');

function buildChallengeJsonSchema({ batchId, batchTarget }) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['batch_id', 'questions'],
    properties: {
      batch_id: { type: 'integer', enum: [batchId] },
      questions: {
        type: 'array',
        minItems: batchTarget,
        maxItems: batchTarget,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'scenario_id', 'difficulty', 'question', 'options', 'correct_answer',
            'explanation', 'challenge_pattern', 'claims_to_verify', 'support_status',
            'status', 'eligible_for_training_mix', 'eligible_for_scoring',
            'assessment_eligible'
          ],
          properties: {
            scenario_id: { type: 'string', minLength: 1 },
            difficulty: { type: 'string', enum: ['intermediate', 'advanced'] },
            question: { type: 'string', minLength: 1 },
            options: {
              type: 'object',
              additionalProperties: false,
              required: ['A', 'B', 'C', 'D'],
              properties: {
                A: { type: 'string', minLength: 1 },
                B: { type: 'string', minLength: 1 },
                C: { type: 'string', minLength: 1 },
                D: { type: 'string', minLength: 1 }
              }
            },
            correct_answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            explanation: { type: 'string', minLength: 1 },
            challenge_pattern: { type: 'string', minLength: 1 },
            claims_to_verify: {
              type: 'array',
              minItems: 1,
              items: { type: 'string', minLength: 1 }
            },
            support_status: {
              type: 'string',
              enum: ['synthetic-draft-pending-evidence']
            },
            status: { type: 'string', enum: ['draft'] },
            eligible_for_training_mix: { type: 'boolean', enum: [false] },
            eligible_for_scoring: { type: 'boolean', enum: [false] },
            assessment_eligible: { type: 'boolean', enum: [false] }
          }
        }
      }
    }
  };
}

function buildChallengeMessages({ batchId, batchTarget, allocation, scenarioContext, retainedQuestions }) {
  const userPrompt = {
    task: 'Create one batch of synthetic challenge-question drafts for the allocated automotive scenario banks.',
    batch_id: batchId,
    batch_target: batchTarget,
    scenario_allocation: allocation,
    constraints: {
      exact_batch_count: true,
      all_allocated_scenarios_required: true,
      options: ['A', 'B', 'C', 'D'],
      exactly_one_correct_answer: true,
      plausible_near_miss_distractors: true,
      no_trick_wording: true,
      no_unsupported_numeric_specs: true,
      no_retained_question_paraphrases: true,
      status: 'draft',
      support_status: 'synthetic-draft-pending-evidence',
      eligible_for_training_mix: false,
      eligible_for_scoring: false,
      assessment_eligible: false
    },
    challenge_patterns: [
      'symptom discrimination',
      'next-best diagnostic step',
      'measurement or test-result interpretation',
      'system/circuit reasoning',
      'safety boundary',
      'repair verification',
      'likely cause versus merely possible cause'
    ],
    output_schema: {
      batch_id: batchId,
      questions: [{
        scenario_id: 'string',
        difficulty: 'intermediate|advanced',
        question: 'string',
        options: { A: 'string', B: 'string', C: 'string', D: 'string' },
        correct_answer: 'A|B|C|D',
        explanation: 'string',
        challenge_pattern: 'string',
        claims_to_verify: ['string'],
        support_status: 'synthetic-draft-pending-evidence',
        status: 'draft',
        eligible_for_training_mix: false,
        eligible_for_scoring: false,
        assessment_eligible: false
      }]
    },
    scenario_context: scenarioContext,
    retained_questions: retainedQuestions
  };

  return [
    { role: 'system', content: SYSTEM_INSTRUCTIONS },
    { role: 'user', content: JSON.stringify(userPrompt) }
  ];
}

module.exports = { AGENT_VERSION, SYSTEM_INSTRUCTIONS, buildChallengeMessages, buildChallengeJsonSchema };
