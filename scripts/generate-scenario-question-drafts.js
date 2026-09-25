const fs = require('fs');
const path = require('path');
const { AGENT_VERSION, selectDrafts } = require('./agents/automotive-question-agent');
const { runOllamaQuestionWorker } = require('./workers/ollama-question-worker');

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

const retainedCandidates = args.retained
  ? [path.resolve(root, args.retained)]
  : [
      path.resolve(root, `data/evidence/review-queues/${scenarioId}-complete-items-revision.json`),
      path.resolve(root, `data/evidence/review-queues/${scenarioId}-human-review-packet.json`)
    ];
const retainedPath = retainedCandidates.find((candidate) => fs.existsSync(candidate));
if (!retainedPath) fail(`A retained-question snapshot is required for ${scenarioId}; pass --retained=<path>.`);
const retainedPacket = JSON.parse(fs.readFileSync(retainedPath, 'utf8'));
if (retainedPacket.scenario_id !== scenarioId || !Array.isArray(retainedPacket.questions)) {
  fail('Retained-question snapshot does not match the requested scenario or has no questions array.');
}
const retainedQuestions = retainedPacket.questions.map((item) => ({
  question_id: item.question_id,
  question: item.question || item.question_text,
  options: item.options,
  correct_answer: item.correct_answer,
  explanation: item.explanation
}));
if (retainedQuestions.some((item) => !item.question_id || !item.question ||
    !item.options || !item.options[item.correct_answer])) {
  fail('Retained-question snapshot has an incomplete question record.');
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

if (dryRun) {
  process.stdout.write(JSON.stringify({
    scenario_id: scenarioId,
    model,
    target_count: targetCount,
    eligible_source_count: approvedSources.size,
    eligible_chunk_count: eligibleChunks.length,
    evidence_chunk_ids: eligibleChunks.map((chunk) => chunk.chunk_id),
    retained_question_count: retainedQuestions.length,
    retained_snapshot: path.relative(root, retainedPath),
    agent_version: AGENT_VERSION
  }, null, 2) + '\n');
  process.exit(0);
}
(async () => {
  const { generated } = await runOllamaQuestionWorker({
    apiUrl, apiKey, model, scenarioId, targetCount, evidenceBundle, retainedQuestions
  });
  const { questions, skippedDuplicates } = selectDrafts({
    generated, scenarioId, targetCount, eligibleChunks, retainedQuestions
  });

  const result = {
    generator: {
      provider: 'ollama-cloud',
      model,
      agent_version: AGENT_VERSION,
      worker: 'ollama-question-worker',
      generated_at: new Date().toISOString(),
      scenario_id: scenarioId,
      requested_count: targetCount,
      returned_count: questions.length,
      skipped_duplicate_count: skippedDuplicates.length,
      retained_snapshot: path.relative(root, retainedPath)
    },
    governance: {
      evidence_only: true,
      rights_verified_sources_only: true,
      auto_approval: false,
      requires_human_technical_review: true,
      requires_human_instructional_review: true
    },
    evidence: evidenceBundle.map(({ text_excerpt, ...metadata }) => metadata),
    questions,
    skipped_duplicates: skippedDuplicates
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${questions.length} draft questions to ${outputPath}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
