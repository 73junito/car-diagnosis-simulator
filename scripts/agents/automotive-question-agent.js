'use strict';

const crypto = require('crypto');
const { findDuplicate } = require('../lib/question-duplicate-guard');

const AGENT_VERSION = 'automotive-question-agent-v2';

const SYSTEM_INSTRUCTIONS = [
  'You are the automotive question-drafting agent. Produce draft items from the supplied rights-verified evidence only.',
  'Do not use outside facts, assumptions, or unstated technical knowledge.',
  'Use vendor-neutral terminology. Do not reference certification bodies, trademarks, or test-area labels.',
  'Every keyed answer and explanation must be directly supported by the supplied evidence chunks.',
  'For scholarly evidence, use only source identifiers, chunk identifiers, DOI values, URLs, publication metadata, authors, publishers, locators, and quotations explicitly supplied in the evidence bundle.',
  'Never invent, guess, alter, or substitute a citation, source_id, chunk_id, DOI, URL, page or section locator, author, publisher, quotation, or evidence statement.',
  'Google Scholar may be used upstream to discover scholarly literature, but a Google Scholar search-result URL is not a canonical citation. Preserve the canonical publisher, DOI, institutional-repository, or authoritative source record supplied in the evidence bundle.',
  'Do not cite a source merely because it appears in retained_questions or source metadata. Cite only supplied evidence chunks that directly support the keyed answer or explanation.',
  'If the supplied evidence does not directly establish the keyed answer, omit the question rather than infer or complete the answer from outside knowledge.',
  'A stem asks one clear question. All four options must answer that same question at the same level of specificity.',
  'Distractors must be credible alternatives of the same kind as the key. A component is not a generator type; a conversion function is not a voltage-control technique.',
  'Exactly one option may be defensibly correct in the stem context. Exclude alternatives that can coexist with, contain, or describe the key.',
  'Compare every candidate with retained_questions. Do not repeat a retained learning target, even with a reworded stem or a different answer position.',
  'Do not invent unsupported claims to make distractors sound plausible. Return fewer than target_count when evidence cannot support distinct, unambiguous items.',
  'Before returning, inspect each whole item for answer-category alignment, overlap, evidence support, and repeated learning targets. Repair or omit failures.',
  'Return JSON only. All output remains draft and requires separate human technical and instructional reviews.'
].join(' ');

function buildQuestionMessages({ scenarioId, targetCount, evidenceBundle, retainedQuestions }) {
  if (!scenarioId || !Array.isArray(evidenceBundle) || !evidenceBundle.length ||
      !Array.isArray(retainedQuestions)) {
    throw new Error('Question agent requires a scenario, evidence, and a retained-question snapshot.');
  }
  const userPrompt = {
    task: 'Draft only new learning targets for this scenario. target_count is a maximum.',
    scenario_id: scenarioId,
    target_count: targetCount,
    constraints: {
      options: ['A', 'B', 'C', 'D'],
      exactly_one_correct_answer: true,
      same_answer_category: true,
      mutually_exclusive_key_and_distractors: true,
      credible_distractors: true,
      no_external_knowledge: true,
      no_retained_learning_target_duplicates: true,
      fewer_items_if_evidence_is_insufficient: true,
      citation_roles: ['supports-answer', 'supports-explanation'],
      difficulty_values: ['introductory', 'intermediate', 'advanced']
    },
    output_schema: {
      questions: [{
        difficulty: 'introductory|intermediate|advanced',
        question: 'string',
        options: { A: 'string', B: 'string', C: 'string', D: 'string' },
        correct_answer: 'A|B|C|D',
        explanation: 'string',
        citations: [
          { source_id: 'string', chunk_id: 'string', role: 'supports-answer' },
          { source_id: 'string', chunk_id: 'string', role: 'supports-explanation' }
        ]
      }]
    },
    evidence: evidenceBundle,
    retained_questions: retainedQuestions
  };
  return [
    { role: 'system', content: SYSTEM_INSTRUCTIONS },
    { role: 'user', content: JSON.stringify(userPrompt) }
  ];
}

function validateDraft(item, index, { scenarioId, eligibleChunks }) {
  if (!item || typeof item !== 'object') throw new Error(`Question ${index + 1} is not an object.`);
  const stem = String(item.question || '').trim();
  if (stem.length < 15) throw new Error(`Question ${index + 1} has an invalid stem.`);
  const options = item.options || {};
  for (const key of ['A', 'B', 'C', 'D']) {
    if (!String(options[key] || '').trim()) throw new Error(`Question ${index + 1} is missing option ${key}.`);
  }
  if (!['A', 'B', 'C', 'D'].includes(item.correct_answer)) {
    throw new Error(`Question ${index + 1} has an invalid correct answer.`);
  }
  const normalizedOptions = ['A', 'B', 'C', 'D'].map((key) =>
    String(options[key]).trim().toLowerCase().replace(/\s+/g, ' ')
  );
  if (new Set(normalizedOptions).size !== 4) {
    throw new Error(`Question ${index + 1} repeats an answer option.`);
  }
  const explanation = String(item.explanation || '').trim();
  if (!explanation) throw new Error(`Question ${index + 1} is missing an explanation.`);
  const citations = Array.isArray(item.citations) ? item.citations : [];
  const roles = new Set(citations.map((citation) => citation.role));
  if (!roles.has('supports-answer') || !roles.has('supports-explanation')) {
    throw new Error(`Question ${index + 1} is missing required citation roles.`);
  }
  const eligibleIds = new Set(eligibleChunks.map((chunk) => `${chunk.source_id}::${chunk.chunk_id}`));
  for (const citation of citations) {
    if (!eligibleIds.has(`${citation.source_id}::${citation.chunk_id}`)) {
      throw new Error(`Question ${index + 1} cites evidence outside the approved bundle.`);
    }
  }
  return {
    scenario_slug: scenarioId,
    question_id: `${scenarioId}-ai-draft-${crypto.createHash('sha256').update(stem).digest('hex').slice(0, 12)}`,
    difficulty: ['introductory', 'intermediate', 'advanced'].includes(item.difficulty)
      ? item.difficulty : 'introductory',
    question: stem,
    options: { A: options.A, B: options.B, C: options.C, D: options.D },
    correct_answer: item.correct_answer,
    explanation,
    citations,
    status: 'draft',
    human_technical_review_completed: false,
    human_instructional_review_completed: false,
    approved: false
  };
}

function selectDrafts({ generated, scenarioId, targetCount, eligibleChunks, retainedQuestions }) {
  const candidates = Array.isArray(generated?.questions) ? generated.questions : [];
  if (!candidates.length) throw new Error('Model returned no question drafts.');
  const questions = [];
  const skippedDuplicates = [];
  for (let index = 0; index < candidates.length && questions.length < targetCount; index += 1) {
    const validated = validateDraft(candidates[index], index, { scenarioId, eligibleChunks });
    const duplicate = findDuplicate(validated, [...retainedQuestions, ...questions]);
    if (duplicate) {
      skippedDuplicates.push({ question_id: validated.question_id, ...duplicate });
      continue;
    }
    questions.push(validated);
  }
  if (!questions.length) {
    throw new Error(`No distinct draft questions remained; filtered ${skippedDuplicates.length} duplicate(s).`);
  }
  return { questions, skippedDuplicates };
}

module.exports = { AGENT_VERSION, SYSTEM_INSTRUCTIONS, buildQuestionMessages, validateDraft, selectDrafts };
