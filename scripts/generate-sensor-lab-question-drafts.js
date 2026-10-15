'use strict';

const fs = require('fs');
const path = require('path');
const { parseModelJson } = require('./lib/parse-model-json');

const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  })
);

const targetCount = Number(args.target || 10);
const model = args.model || 'gpt-oss:20b';
const outputPath = path.resolve(root, args.output || 'sensor-lab-ollama-drafts.json');
const apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';
const apiKey = process.env.OLLAMA_API_KEY || '';
const dryRun = args['dry-run'] === 'true';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 20) {
  fail('--target must be an integer from 1 through 20.');
}
if (!dryRun && !apiKey) fail('OLLAMA_API_KEY is required unless --dry-run=true.');

const runtime = JSON.parse(fs.readFileSync(path.join(root, 'data/architecture/sensor-lab-lmf-runtime.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(root, 'data/circuit-templates/12v-three-wire-sensor.json'), 'utf8'));

if (runtime.labId !== 'sensor-lab') fail('Sensor Lab runtime is invalid.');
if (runtime.modelRef !== '/data/circuit-templates/12v-three-wire-sensor.json') {
  fail('Sensor Lab runtime is not bound to the expected project-authored template.');
}

const facts = {
  lab_id: runtime.labId,
  engineering_adapter: runtime.engineeringAdapterId,
  tools: runtime.toolIds,
  measurement_types: runtime.measurementTypes,
  fault_classes: runtime.faultClassIds,
  assessment_authority: runtime.assessmentEligibilityAuthority,
  publication_authority: runtime.publicationAuthority,
  voltage_systems: template.voltageSystems.map((item) => ({
    id: item.id,
    nominalVoltage: item.nominalVoltage,
    unit: item.unit,
    displayLabel: item.displayLabel
  })),
  test_points: template.testPoints.map((item) => ({
    id: item.id,
    terminalId: item.terminalId,
    measurementTypes: item.measurementTypes,
    vehicleSpecificValueRequired: item.vehicleSpecificValueRequired
  })),
  faults: template.faultCatalog.map((item) => ({
    id: item.id,
    type: item.type,
    targetConnectionId: item.targetConnectionId || null,
    targetTerminalId: item.targetTerminalId || null,
    shortTargetTerminalId: item.shortTargetTerminalId || null,
    label: item.label
  })),
  operating_states: template.operatingStates.map((item) => ({
    id: item.id,
    label: item.label,
    note: item.note
  })),
  evidence_boundary: template.provenance?.rule || template.safetyBoundary?.notice || null
};

const system = [
  'You are the AutoLearnPro draft-only automotive question agent.',
  'Use ONLY the project-authored Sensor Lab facts supplied by the caller.',
  'Do not invent vehicle-specific sensor voltages, pinouts, waveforms, procedures, limits, or diagnostic thresholds.',
  'The 5 V value is a generic training reference, not a universal vehicle specification.',
  'Do not infer a numeric result where the supplied model says vehicle-specific information is required.',
  'Questions are training drafts only. They are not scored, approved, high-stakes, institutional-assessment, or publication-ready.',
  'Focus on three-wire sensor power/reference, signal, ground/reference, test-point selection, fault reasoning, DMM/oscilloscope choice, and the distinction between sensor-side and controller-observed signal.',
  'Return JSON only.'
].join(' ');

const user = JSON.stringify({
  task: 'Generate Sensor Lab diagnostic reasoning question drafts for human verification.',
  required_task_status: 'completed',
  requested_count: targetCount,
  required_schema: {
    task_status: 'completed',
    questions: [{
      question_id: 'sensor-draft-001',
      focus_area: 'string',
      question: 'string',
      options: { A: 'string', B: 'string', C: 'string', D: 'string' },
      correct_answer: 'A|B|C|D',
      rationale: 'string',
      status: 'draft',
      approved: false
    }]
  },
  project_authored_sensor_lab_facts: facts
}, null, 2);

if (dryRun) {
  process.stdout.write(JSON.stringify({
    task: 'sensor-lab-draft-generation',
    provider: 'ollama-cloud',
    model,
    target_count: targetCount,
    source_context: 'project-authored-sensor-lab-runtime-and-template-only',
    third_party_source_text_sent_to_model: false,
    auto_approval: false,
    facts
  }, null, 2) + '\n');
  process.exit(0);
}

(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false,
        format: 'json',
        options: { temperature: 0.2 }
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Ollama API returned ${response.status}.`);
    const payload = await response.json();
    const content = payload?.message?.content || payload?.response || '';
    if (!content) throw new Error('Ollama API returned no usable content.');

    const generated = parseModelJson(content);
    if (generated.task_status !== 'completed') throw new Error('Ollama did not return task_status=completed.');
    if (!Array.isArray(generated.questions) || generated.questions.length !== targetCount) {
      throw new Error(`Expected ${targetCount} questions from Ollama.`);
    }

    const ids = new Set();
    for (const question of generated.questions) {
      if (!question.question_id || ids.has(question.question_id)) throw new Error('Question IDs must be unique.');
      ids.add(question.question_id);
      if (!question.question || !question.focus_area || !question.rationale) throw new Error('Question draft is incomplete.');
      if (!question.options || ['A','B','C','D'].some((key) => !question.options[key])) throw new Error('Question options are incomplete.');
      if (!['A','B','C','D'].includes(question.correct_answer)) throw new Error('Invalid correct answer key.');
      if (question.status !== 'draft' || question.approved !== false) throw new Error('Question escaped draft-only governance.');
    }

    const result = {
      task_status: 'completed',
      verification_status: 'pending-human-review',
      generator: {
        provider: 'ollama-cloud',
        model,
        generated_at: new Date().toISOString(),
        requested_count: targetCount,
        returned_count: generated.questions.length
      },
      governance: {
        source_context: 'project-authored-sensor-lab-runtime-and-template-only',
        third_party_source_text_sent_to_model: false,
        auto_database_write: false,
        auto_approval: false,
        scored: false,
        high_stakes_eligible: false,
        institutional_assessment_eligible: false,
        production_assessment_api_eligible: false,
        requires_human_technical_review: true,
        requires_human_instructional_review: true
      },
      questions: generated.questions
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`OLLAMA_TASK_STATUS=completed`);
    console.log(`Wrote ${generated.questions.length} Sensor Lab draft questions to ${outputPath}`);
  } finally {
    clearTimeout(timer);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
