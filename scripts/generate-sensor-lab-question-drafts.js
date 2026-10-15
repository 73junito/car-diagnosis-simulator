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
const engineering = JSON.parse(fs.readFileSync(path.join(root, 'data/engineering/labs/sensor-training.json'), 'utf8'));

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
  engineering_profile: {
    profile_id: engineering.profileId,
    notice: engineering.notice,
    signal_type: engineering.sensorProfile?.engineeringProfile?.signalType,
    signal_range: engineering.sensorProfile?.engineeringProfile?.parameters?.signalRange,
    fault_behavior: engineering.faultBehavior
  },
  evidence_boundary: template.provenance?.rule || template.safetyBoundary?.notice || null,
  generation_rules: {
    runtime_capability_is_not_component_behavior: true,
    scan_tool_availability_does_not_establish_a_specific_pid_or_sensor_activity_value: true,
    frequency_or_duty_cycle_support_does_not_mean_this_analog_voltage_sensor_outputs_frequency_or_duty_cycle: true,
    sensor_side_ideal_transfer_and_controller_observed_signal_are_distinct: true,
    short_fault_forced_values_apply_to_controller_observed_signal_only: true,
    open_signal_may_preserve_ideal_transfer_while_controller_signal_is_unavailable: true,
    unavailable_faults_do_not_authorize_numeric_sensor_output_inference: true,
    ground_questions_must_not_invent_numeric_results_or_thresholds: true,
    continuity_procedure_requires_deenergized_or_isolated_context: true,
    five_volt_reference_is_training_example_not_vehicle_specification: true
  }
};

const system = [
  'You are the AutoLearnPro draft-only automotive question agent.',
  'Use ONLY the project-authored Sensor Lab facts supplied by the caller.',
  'Treat the circuit template and engineering profile as authoritative for this task.',
  'A runtime-supported tool or measurement type is capability metadata only; it does not prove that the modeled sensor produces that quantity.',
  'Do not treat frequency, duty cycle, waveform shape, scan-tool PID content, or diagnostic_data as established sensor behavior unless the supplied engineering profile explicitly establishes it.',
  'The modeled sensor signal type is analog_voltage.',
  'Keep sensor-side ideal transfer and controller-observed signal separate.',
  'For FAULT_SIGNAL_SHORT_GROUND and FAULT_SIGNAL_SHORT_POWER, forced values apply only to controller-observed signal unless an authoritative fact explicitly says otherwise.',
  'For FAULT_OPEN_SIGNAL, ideal sensor transfer may remain calculable while controller-observed signal is unavailable.',
  'For open sensor power, open sensor ground, and high-resistance sensor ground, do not invent a numeric sensor output.',
  'At TP_SENSOR_GROUND, do not invent voltage-drop, resistance, continuity, or pass/fail values.',
  'If continuity testing is discussed as a procedure, state that the circuit is appropriately de-energized or isolated and do not describe continuity alone as proving acceptable loaded-circuit performance.',
  'Do not invent vehicle-specific sensor voltages, pinouts, waveforms, procedures, limits, or diagnostic thresholds.',
  'The 5 V value and 0.5–4.5 V transfer range are generic training examples, not universal vehicle specifications.',
  'Scan-tool availability does not establish a particular PID, parameter, or sensor-activity value.',
  'Do not infer a numeric result where the supplied model says vehicle-specific information is required or output is unavailable/not inferred.',
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
      basis_ids: ['exact supplied fact/rule identifiers'],
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

    const validBasisIds = new Set([
      ...runtime.toolIds,
      ...runtime.measurementTypes.map((id) => `measurement:${id}`),
      ...template.testPoints.map((item) => item.id),
      ...template.faultCatalog.map((item) => item.id),
      ...template.operatingStates.map((item) => item.id),
      ...engineering.faultBehavior.map((item) => item.faultId),
      'engineering:analog_voltage',
      'engineering:signal_range',
      ...Object.keys(facts.generation_rules).map((id) => `rule:${id}`)
    ]);

    function normalizeQuestionText(question) {
      return [
        question.focus_area,
        question.question,
        question.rationale,
        ...Object.values(question.options || {})
      ].join(' ').toLowerCase();
    }

    function enforceSensorRules(question) {
      const text = normalizeQuestionText(question);
      const rejectionContext = /not established|does not establish|cannot infer|not supported|avoid assuming|should not assume/.test(text);

      const referencesSensorSignal = /tp_sensor_signal|sensor-side|sensor side/.test(text);
      const referencesEcmSignal = /tp_ecm_signal|controller-observed|controller observed|ecm signal|controller signal/.test(text);
      const referencesShortFault = /short(?:ed)? to ground|short(?:ed)? to (?:power|reference)|fault_signal_short_(?:ground|power)/.test(text);
      const assertsForcedNumeric = /\b0(?:\.0+)?\s*v(?:olts?)?\b|\bzero volts?\b|\b5(?:\.0+)?\s*v(?:olts?)?\b|\bnominal 5 v\b/.test(text);
      if (referencesShortFault && referencesSensorSignal && assertsForcedNumeric && !referencesEcmSignal) {
        throw new Error(`Question ${question.question_id} invents a short-fault numeric effect at TP_SENSOR_SIGNAL.`);
      }

      const frequencyDutyClaim = /frequency|duty[_ -]?cycle|cycles per second/.test(text);
      if (frequencyDutyClaim && !rejectionContext) {
        throw new Error(`Question ${question.question_id} treats generic frequency/duty support as modeled sensor behavior.`);
      }

      const scanToolClaim = /scan[- ]?tool|diagnostic_data|diagnostic data/.test(text);
      const scanSpecificBehavior = /confirm.*sensor.*(?:active|generating)|sensor status|sensor activity|\bpid\b|parameter value/.test(text);
      if (scanToolClaim && scanSpecificBehavior && !rejectionContext) {
        throw new Error(`Question ${question.question_id} invents scan-tool PID or activity semantics.`);
      }

      const groundClaim = /tp_sensor_ground|sensor ground/.test(text);
      const groundNumericOrThreshold = /\b\d+(?:\.\d+)?\s*(?:v|volt|ohm)|high voltage drop|low resistance|acceptable|within spec|pass|fail/.test(text);
      if (groundClaim && groundNumericOrThreshold && !rejectionContext) {
        throw new Error(`Question ${question.question_id} invents a Sensor Lab ground result or threshold.`);
      }

      const continuityProcedure = /continuity/.test(text) && /(check|test|measure|confirm|verify)/.test(text);
      if (continuityProcedure && !/de-energ|isolat/.test(text)) {
        throw new Error(`Question ${question.question_id} omits de-energized/isolated context for continuity testing.`);
      }
    }

    const ids = new Set();
    for (const question of generated.questions) {
      if (!question.question_id || ids.has(question.question_id)) throw new Error('Question IDs must be unique.');
      ids.add(question.question_id);
      if (!question.question || !question.focus_area || !question.rationale) throw new Error('Question draft is incomplete.');
      if (!question.options || ['A','B','C','D'].some((key) => !question.options[key])) throw new Error('Question options are incomplete.');
      if (!['A','B','C','D'].includes(question.correct_answer)) throw new Error('Invalid correct answer key.');
      if (!Array.isArray(question.basis_ids) || question.basis_ids.length === 0) throw new Error(`Question ${question.question_id} has no evidence basis IDs.`);
      for (const basisId of question.basis_ids) {
        if (!validBasisIds.has(basisId)) throw new Error(`Question ${question.question_id} cites unknown basis ID: ${basisId}`);
      }
      enforceSensorRules(question);
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
        deterministic_sensor_rule_validation: true,
        runtime_capability_not_component_behavior_rule: true,
        sensor_vs_controller_signal_separation_rule: true,
        unavailable_value_non_inference_rule: true,
        continuity_safety_context_rule: true,
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
