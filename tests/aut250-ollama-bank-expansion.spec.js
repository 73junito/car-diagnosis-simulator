const fs = require('fs');
const path = require('path');
const { buildMessages, selectDrafts, AGENT_VERSION } =
  require('../scripts/agents/aut250-question-expansion-agent');

const root = path.resolve(__dirname, '..');
const curriculum = JSON.parse(fs.readFileSync(
  path.join(root, 'data/curriculum/lesson-content.json'), 'utf8'
));
const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');

describe('AUT-250 Ollama question bank expansion contract', () => {
  test('uses project-authored curriculum and retained questions only', () => {
    const messages = buildMessages({ plan, targetCount: 20 });
    expect(AGENT_VERSION).toBe('aut250-metadata-safe-question-agent-v1');
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);

    const system = messages[0].content;
    expect(system).toContain('Use only the supplied project-authored curriculum context');
    expect(system).toContain('Do not use outside technical facts');
    expect(system).toContain('Do not quote, summarize, paraphrase, or infer from third-party publications');
    expect(system).toContain('Do not invent citations');
    expect(system).toContain('All output is draft-only formative training content');
    expect(system).toContain('Request → Measure → Compare → Correlate → Verify');

    const request = JSON.parse(messages[1].content);
    expect(request.project_authored_curriculum).toHaveLength(6);
    expect(request.retained_questions).toHaveLength(20);
    expect(request.constraints.no_third_party_source_text).toBe(true);
    expect(request.constraints.no_citation_generation).toBe(true);
    expect(request.constraints.scored).toBe(false);
    expect(request.constraints.high_stakes_eligible).toBe(false);
    expect(request).not.toHaveProperty('evidence');
    expect(request).not.toHaveProperty('sources');
  });

  test('filters duplicates and stamps every returned item as unapproved training draft', () => {
    const retained = plan.courseModules[0].trainingQuestions[0];
    const duplicate = {
      module_id: plan.courseModules[0].id,
      difficulty: 'intermediate',
      topic: retained.topic,
      reasoning_focus: 'compare',
      question: retained.stem,
      options: retained.choices,
      correct_answer: retained.answer,
      explanation: retained.explanation
    };
    const distinct = {
      module_id: plan.courseModules[5].id,
      difficulty: 'intermediate',
      topic: 'evidence-ordering',
      reasoning_focus: 'correlate',
      question: 'When several observations could support more than one explanation, what should the technician do before selecting a cause?',
      options: {
        A: 'Choose the first explanation that matches one observation',
        B: 'Correlate the observations and seek evidence that distinguishes the competing explanations',
        C: 'Replace the component named by the first diagnostic code',
        D: 'Ignore operating context once a symptom has been reproduced'
      },
      correct_answer: 'B',
      explanation: 'The project reasoning model keeps competing explanations open until correlated evidence meaningfully distinguishes them.'
    };

    const result = selectDrafts({
      generated: { questions: [duplicate, distinct] },
      plan,
      targetCount: 20
    });

    expect(result.skippedDuplicates).toHaveLength(1);
    expect(result.questions).toHaveLength(1);
    const draft = result.questions[0];
    expect(draft.status).toBe('draft');
    expect(draft.delivery_mode).toBe('training');
    expect(draft.scored).toBe(false);
    expect(draft.high_stakes_eligible).toBe(false);
    expect(draft.institutional_assessment_eligible).toBe(false);
    expect(draft.production_assessment_api_eligible).toBe(false);
    expect(draft.citation_status).toBe('pending-human-metadata-mapping');
    expect(draft.approved).toBe(false);
    expect(draft.human_rights_review_completed).toBe(false);
    expect(draft.human_technical_review_completed).toBe(false);
    expect(draft.human_instructional_review_completed).toBe(false);
    expect(draft.human_safety_review_completed).toBe(false);
  });

  test('workflow keeps API_GITHUB inside the protected Ollama environment and never writes to a database', () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github/workflows/generate-aut250-question-drafts.yml'), 'utf8'
    );
    expect(workflow).toContain('environment: ollama');
    expect(workflow).toContain('secrets.API_GITHUB');
    expect(workflow).toContain('https://ollama.com/api/chat');
    expect(workflow).toContain('No third-party source text or excerpt was sent.');
    expect(workflow).toContain('No database write, scoring change, assessment eligibility change, or automatic approval occurred.');
    expect(workflow).not.toMatch(/SUPABASE_(SERVICE_ROLE_KEY|DB|SECRET|URL)/);
    expect(workflow).not.toMatch(/psql|supabase db|apply_migration/i);
    expect(workflow).not.toMatch(/echo\s+.*OLLAMA_API_KEY/i);
  });

  test('dry run validates both approved training banks without contacting Ollama', () => {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      process.execPath,
      ['scripts/generate-aut250-question-drafts.js', '--target=20', '--dry-run=true'],
      { cwd: root, encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.retained_question_count).toBe(40);
    expect(report.module_count).toBe(6);
    expect(report.governance.approved_training_bank).toBe(true);
    expect(report.governance.approved_training_batches).toBe(2);
    expect(report.governance.third_party_source_text_sent_to_model).toBe(false);
    expect(report.governance.auto_approval).toBe(false);
  });
});
