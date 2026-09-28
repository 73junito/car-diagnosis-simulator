'use strict';

const crypto = require('crypto');
const { findDuplicate } = require('../lib/question-duplicate-guard');

const AGENT_VERSION = 'aut250-metadata-safe-question-agent-v1';

const SYSTEM_INSTRUCTIONS = [
  'You are the AutoLearnPro AUT-250 draft-question expansion agent.',
  'Use only the supplied project-authored curriculum context and retained approved questions.',
  'Do not use outside technical facts, web knowledge, third-party source text, or unstated vehicle-specific information.',
  'Do not quote, summarize, paraphrase, or infer from third-party publications because no third-party excerpts are being supplied to you.',
  'Do not invent citations, source identifiers, URLs, DOI values, authors, publishers, standards, service procedures, or technical specifications.',
  'Use vendor-neutral terminology.',
  'Do not reference certification bodies, trademarks, certification test areas, or proprietary service labels.',
  'All output is draft-only formative training content.',
  'Every question must remain non-scored and not eligible for high-stakes, institutional, or production-assessment use.',
  'Never provide universal voltage thresholds, wait times, PPE classes, meter categories, isolation procedures, test points, replacement thresholds, or component-specific service instructions.',
  'Never instruct bypassing interlocks, defeating protection systems, energized high-voltage probing, or intrusive testing.',
  'Do not treat one DTC, symptom, measurement, state estimate, communication fault, or observation as sufficient proof of component failure.',
  'The project-authored reasoning model is Request → Measure → Compare → Correlate → Verify. You may use it as a learning framework but must not attribute it to an external source.',
  'Write one clear stem with four options A-D. Exactly one option must be defensibly correct from the supplied project-authored context.',
  'Distractors must be plausible misconceptions at the same level of specificity as the keyed answer and must not teach unsafe shortcuts.',
  'Explanations must reinforce evidence preservation, uncertainty, context, correlation, and verification where relevant.',
  'Compare each candidate with retained_questions. Do not repeat an existing learning target merely by rewording the stem or moving the answer position.',
  'If a distinct item cannot be written safely from the supplied curriculum, omit it. Returning fewer than target_count is preferred to inventing unsupported content.',
  'Return JSON only and follow the requested schema exactly.'
].join(' ');

function compactModule(module) {
  return {
    id: module.id,
    sequence: module.sequence,
    title: module.title,
    estimatedMinutes: module.estimatedMinutes,
    moduleObjectives: module.moduleObjectives || [],
    safetyAndEvidenceBoundary: module.safetyAndEvidenceBoundary || '',
    lessons: (module.lessons || []).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      objective: lesson.objective || '',
      content: lesson.content || ''
    })),
    practiceActivities: module.practiceActivities || []
  };
}

function compactRetained(module) {
  return (module.trainingQuestions || []).map((question) => ({
    question_id: question.id,
    module_id: module.id,
    question: question.stem,
    options: question.choices,
    correct_answer: question.answer,
    explanation: question.explanation,
    topic: question.topic
  }));
}

function buildMessages({ plan, targetCount }) {
  const modules = (plan.courseModules || []).map(compactModule);
  const retainedQuestions = (plan.courseModules || []).flatMap(compactRetained);

  const request = {
    task: 'Draft additional AUT-250 formative-training questions with distinct learning targets.',
    target_count: targetCount,
    requested_distribution: {
      'aut250-m1-battery-systems': 4,
      'aut250-m2-power-electronics': 4,
      'aut250-m3-charging': 3,
      'aut250-m4-thermal': 3,
      'aut250-m5-low-voltage': 3,
      'aut250-m6-diagnostic-reasoning': 3
    },
    constraints: {
      output_is_draft_only: true,
      scored: false,
      high_stakes_eligible: false,
      institutional_assessment_eligible: false,
      production_assessment_api_eligible: false,
      no_external_knowledge: true,
      no_third_party_source_text: true,
      no_citation_generation: true,
      no_vehicle_specific_service_values: true,
      no_unsafe_service_instructions: true,
      no_single_clue_root_cause_overreach: true,
      no_retained_learning_target_duplicates: true,
      fewer_items_if_distinct_safe_items_are_not_available: true,
      options: ['A','B','C','D'],
      difficulty_values: ['introductory','intermediate','advanced'],
      reasoning_focus_values: ['request','measure','compare','correlate','verify']
    },
    output_schema: {
      questions: [{
        module_id: 'one supplied AUT-250 module id',
        difficulty: 'introductory|intermediate|advanced',
        topic: 'short-kebab-case-topic',
        reasoning_focus: 'request|measure|compare|correlate|verify',
        question: 'string',
        options: { A: 'string', B: 'string', C: 'string', D: 'string' },
        correct_answer: 'A|B|C|D',
        explanation: 'string'
      }]
    },
    project_authored_curriculum: modules,
    retained_questions: retainedQuestions
  };

  return [
    { role: 'system', content: SYSTEM_INSTRUCTIONS },
    { role: 'user', content: JSON.stringify(request) }
  ];
}

function validateCandidate(item, index, moduleIds) {
  if (!item || typeof item !== 'object') throw new Error(`Question ${index + 1} is not an object.`);
  if (!moduleIds.has(item.module_id)) throw new Error(`Question ${index + 1} uses an unknown module_id.`);

  const stem = String(item.question || '').trim();
  if (stem.length < 20) throw new Error(`Question ${index + 1} has an invalid stem.`);

  const options = item.options || {};
  for (const key of ['A','B','C','D']) {
    if (!String(options[key] || '').trim()) throw new Error(`Question ${index + 1} is missing option ${key}.`);
  }
  const normalized = ['A','B','C','D'].map((key) => String(options[key]).trim().toLowerCase().replace(/\s+/g,' '));
  if (new Set(normalized).size !== 4) throw new Error(`Question ${index + 1} repeats an option.`);
  if (!['A','B','C','D'].includes(item.correct_answer)) throw new Error(`Question ${index + 1} has an invalid key.`);

  const explanation = String(item.explanation || '').trim();
  if (explanation.length < 20) throw new Error(`Question ${index + 1} has an invalid explanation.`);

  const difficulty = ['introductory','intermediate','advanced'].includes(item.difficulty)
    ? item.difficulty : 'introductory';
  const reasoningFocus = ['request','measure','compare','correlate','verify'].includes(item.reasoning_focus)
    ? item.reasoning_focus : 'compare';
  const topic = String(item.topic || 'diagnostic-reasoning').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'diagnostic-reasoning';

  return {
    module_id: item.module_id,
    question_id: `${item.module_id}-ollama-draft-${crypto.createHash('sha256').update(stem).digest('hex').slice(0,12)}`,
    difficulty,
    topic,
    reasoning_focus: reasoningFocus,
    question: stem,
    options: { A: options.A, B: options.B, C: options.C, D: options.D },
    correct_answer: item.correct_answer,
    explanation,
    status: 'draft',
    delivery_mode: 'training',
    scored: false,
    high_stakes_eligible: false,
    institutional_assessment_eligible: false,
    production_assessment_api_eligible: false,
    citation_status: 'pending-human-metadata-mapping',
    approved: false,
    human_rights_review_completed: false,
    human_technical_review_completed: false,
    human_instructional_review_completed: false,
    human_safety_review_completed: false
  };
}

function selectDrafts({ generated, plan, targetCount }) {
  const moduleIds = new Set((plan.courseModules || []).map((module) => module.id));
  const retained = (plan.courseModules || []).flatMap(compactRetained);
  const candidates = Array.isArray(generated?.questions) ? generated.questions : [];
  if (!candidates.length) throw new Error('Ollama returned no AUT-250 draft questions.');

  const questions = [];
  const skippedDuplicates = [];
  for (let index = 0; index < candidates.length && questions.length < targetCount; index += 1) {
    const draft = validateCandidate(candidates[index], index, moduleIds);
    const duplicate = findDuplicate(draft, [...retained, ...questions]);
    if (duplicate) {
      skippedDuplicates.push({ question_id: draft.question_id, ...duplicate });
      continue;
    }
    questions.push(draft);
  }

  if (!questions.length) {
    throw new Error(`No distinct AUT-250 drafts remained; filtered ${skippedDuplicates.length} duplicate(s).`);
  }
  return { questions, skippedDuplicates };
}

module.exports = { AGENT_VERSION, SYSTEM_INSTRUCTIONS, buildMessages, selectDrafts };
