const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseModelJson } = require('./lib/parse-model-json');

const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const scenarioId = args.scenario || '';
const model = args.model || 'gpt-oss:20b';
const targetCount = Number(args.target || 8);
const evidencePath = path.resolve(root, args.evidence || 'data/evidence/open-scholarly/scholarly-evidence-chunks.json');
const manifestPath = path.resolve(root, args.manifest || 'data/evidence/open-scholarly/scholarly-source-manifest.json');
const policyPath = path.resolve(root, 'data/evidence/open-evidence-source-policy.json');
const outputPath = path.resolve(root, args.output || 'question-drafts.json');
const apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';
const apiKey = process.env.OLLAMA_API_KEY || '';
const dryRun = args['dry-run'] === 'true';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(scenarioId)) fail('A valid --scenario=<id> is required.');
if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 20) {
  fail('--target must be an integer from 1 through 20.');
}
if (!dryRun && !apiKey) fail('OLLAMA_API_KEY is required unless --dry-run=true.');

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

const acceptedRights = new Set(policy.accepted_rights_classifications || []);
const approvedSources = new Map(
  (manifest.sources || [])
    .filter((source) =>
      source.reviewer_approved === true &&
      source.status === 'validated' &&
      acceptedRights.has(source.license_classification) &&
      Array.isArray(source.scenarios) &&
      source.scenarios.includes(scenarioId)
    )
    .map((source) => [source.id, source])
);

const eligibleChunks = (evidence.chunks || []).filter((chunk) =>
  chunk.scenario === scenarioId &&
  approvedSources.has(chunk.source_id) &&
  chunk.chunk_id &&
  chunk.text_excerpt &&
  chunk.text_hash
);

if (eligibleChunks.length === 0) {
  fail(`No rights-verified, reviewer-approved evidence chunks are available for ${scenarioId}.`);
}
function compactSource(source) {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    publication_year: source.publication_year,
    article_url: source.article_url,
    doi: source.doi,
    license_classification: source.license_classification,
    license_url: source.license_url
  };
}

const evidenceBundle = eligibleChunks.map((chunk) => ({
  chunk_id: chunk.chunk_id,
  source_id: chunk.source_id,
  section: chunk.section,
  locator: chunk.locator,
  text_excerpt: chunk.text_excerpt,
  text_hash: chunk.text_hash,
  source: compactSource(approvedSources.get(chunk.source_id))
}));

const systemPrompt = [
  'You draft automotive diagnostic training questions from supplied evidence only.',
  'Do not use outside facts, assumptions, or unstated technical knowledge.',
  'Use vendor-neutral terminology and do not reference third-party certification bodies, trademarks, or test-area labels.',
  'Every keyed answer and explanation must be directly supported by one or more supplied evidence chunks.',
  'Write a complete item: the stem asks one clear question and all four options answer that same question at the same level of specificity.',
  'Distractors must be credible alternatives of the same kind as the keyed answer, not a component when the stem asks for a generator type or a function when it asks for a control technique.',
  'Exactly one option may be defensibly correct. Reject a distractor if it can coexist with, include, or describe the keyed answer in the context of the stem.',
  'Do not invent unsupported technical claims to make an option sound plausible. If the evidence cannot support an unambiguous item with three credible distractors, omit the item; fewer drafts are acceptable.',
  'Before returning JSON, silently check each complete item for answer-category alignment, conceptual overlap, evidence support, and duplicate learning targets. Repair or omit failures.',
  'Return JSON only. Drafts are never approved automatically.'
].join(' ');

const userPrompt = JSON.stringify({
  task: 'Create distinct multiple-choice draft questions for the requested scenario.',
  scenario_id: scenarioId,
  target_count: targetCount,
  constraints: {
    options: ['A', 'B', 'C', 'D'],
    exactly_one_correct_answer: true,
    difficulty_values: ['introductory', 'intermediate', 'advanced'],
    require_supports_answer_citation: true,
    require_supports_explanation_citation: true,
    no_external_knowledge: true,
    avoid_duplicate_stems: true,
    avoid_duplicate_learning_targets: true,
    distractors_same_answer_category_as_key: true,
    distractors_mutually_exclusive_with_key_in_stem_context: true,
    distractors_technically_plausible_without_unsupported_claims: true,
    review_whole_item_before_returning: true,
    return_fewer_than_target_if_quality_rules_cannot_be_met: true
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
  evidence: evidenceBundle
}, null, 2);

if (dryRun) {
  process.stdout.write(JSON.stringify({
    scenario_id: scenarioId,
    model,
    target_count: targetCount,
    eligible_source_count: approvedSources.size,
    eligible_chunk_count: eligibleChunks.length,
    evidence_chunk_ids: eligibleChunks.map((chunk) => chunk.chunk_id)
  }, null, 2) + '\n');
  process.exit(0);
}
async function callOllama() {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      format: 'json',
      options: { temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 1000);
    throw new Error(`Ollama API returned ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const text = payload?.message?.content || payload?.response || '';
  if (!text) throw new Error('Ollama API returned no usable content.');

  return parseModelJson(text);
}

function normalizeStem(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function validateQuestion(question, index) {
  if (!question || typeof question !== 'object') throw new Error(`Question ${index + 1} is not an object.`);
  const stem = String(question.question || '').trim();
  if (stem.length < 15) throw new Error(`Question ${index + 1} has an invalid stem.`);
  const options = question.options || {};
  for (const key of ['A', 'B', 'C', 'D']) {
    if (!String(options[key] || '').trim()) throw new Error(`Question ${index + 1} is missing option ${key}.`);
  }
  if (!['A', 'B', 'C', 'D'].includes(question.correct_answer)) {
    throw new Error(`Question ${index + 1} has an invalid correct answer.`);
  }
  const normalizedOptions = ['A', 'B', 'C', 'D'].map((key) =>
    String(options[key]).trim().toLowerCase().replace(/\\s+/g, ' ')
  );
  if (new Set(normalizedOptions).size !== 4) {
    throw new Error(`Question ${index + 1} repeats an answer option.`);
  }
  if (!String(question.explanation || '').trim()) {
    throw new Error(`Question ${index + 1} is missing an explanation.`);
  }

  const citations = Array.isArray(question.citations) ? question.citations : [];
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
    difficulty: ['introductory', 'intermediate', 'advanced'].includes(question.difficulty)
      ? question.difficulty
      : 'introductory',
    question: stem,
    options: { A: options.A, B: options.B, C: options.C, D: options.D },
    correct_answer: question.correct_answer,
    explanation: String(question.explanation || '').trim(),
    citations,
    status: 'draft',
    human_technical_review_completed: false,
    human_instructional_review_completed: false,
    approved: false
  };
}
(async () => {
  const generated = await callOllama();
  const candidates = Array.isArray(generated.questions) ? generated.questions : [];
  if (candidates.length === 0) throw new Error('Model returned no question drafts.');

  const seen = new Set();
  const questions = [];
  for (let index = 0; index < candidates.length && questions.length < targetCount; index += 1) {
    const validated = validateQuestion(candidates[index], index);
    const key = normalizeStem(validated.question);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(validated);
  }

  if (questions.length === 0) throw new Error('No unique valid question drafts remained after validation.');

  const result = {
    generator: {
      provider: 'ollama-cloud',
      model,
      generated_at: new Date().toISOString(),
      scenario_id: scenarioId,
      requested_count: targetCount,
      returned_count: questions.length
    },
    governance: {
      evidence_only: true,
      rights_verified_sources_only: true,
      auto_approval: false,
      requires_human_technical_review: true,
      requires_human_instructional_review: true
    },
    evidence: evidenceBundle.map(({ text_excerpt, ...metadata }) => metadata),
    questions
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${questions.length} draft questions to ${outputPath}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
