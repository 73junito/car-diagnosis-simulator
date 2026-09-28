const fs = require('fs');
const path = require('path');

describe('assessment attempt question binding contract', () => {
  const root = path.join(__dirname, '..');
  const migration = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260928072000_add_assessment_attempt_question_binding.sql'),
    'utf8'
  );
  const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8');
  const startRoute = fs.readFileSync(path.join(root, 'worker/routes/assessment-attempts-start.js'), 'utf8');
  const questionRoute = fs.readFileSync(path.join(root, 'worker/routes/assessment-attempt-questions.js'), 'utf8');
  const gradeRoute = fs.readFileSync(path.join(root, 'worker/routes/scenario-submissions-grade.js'), 'utf8');
  const scenarioClient = fs.readFileSync(path.join(root, 'dashboard/student/scenario/scenario.js'), 'utf8');

  test('assessment eligibility is explicit and empty by default', () => {
    expect(migration).toContain('public.assessment_question_eligibility');
    expect(migration).toContain("eligibility_status in ('approved', 'revoked')");
    expect(migration).not.toMatch(/insert\s+into\s+public\.assessment_question_eligibility/i);
    expect(migration).toMatch(/training approval does not grant assessment eligibility/i);
  });

  test('attempt question assignments are immutable service-role records', () => {
    expect(migration).toContain('public.attempt_questions');
    expect(migration).toMatch(/primary key \(attempt_id, question_id\)/i);
    expect(migration).toMatch(/unique \(attempt_id, sequence\)/i);
    expect(migration).toContain('grant select, insert on public.attempt_questions to service_role');
    expect(migration).not.toContain('grant select, insert, update on public.attempt_questions');
  });

  test('atomic start function requires explicit eligibility and evidence approval', () => {
    expect(migration).toContain('start_assessment_attempt_v1');
    expect(migration).toContain("aqe.eligibility_status = 'approved'");
    expect(migration).toContain("qp.status = 'approved'");
    expect(migration).toContain("cv.result = 'valid'");
    expect(migration).toContain('assessment_bank_not_ready');
    expect(migration).toContain('insert into public.attempt_questions');
  });

  test('assessment startup uses the atomic database binding function', () => {
    expect(startRoute).toContain("supabase.rpc('start_assessment_attempt_v1'");
    expect(startRoute).toContain('p_question_count: 20');
    expect(startRoute).toContain('Assessment bank is not approved and ready for delivery');
  });

  test('Worker exposes authenticated attempt-specific question retrieval', () => {
    expect(workerIndex).toContain("/api/assessment-attempts/:attempt_id/questions");
    expect(workerIndex).toContain('handleAssessmentAttemptQuestions');
    expect(questionRoute).toContain(".from('attempt_questions')");
    expect(questionRoute).toContain(".from('assessment_question_eligibility')");
    expect(questionRoute).toContain("attempt.user_id !== user.id");
    expect(questionRoute).not.toMatch(/select\([^)]*correct_answer/i);
  });

  test('assessment grading rejects questions not assigned to the attempt', () => {
    expect(gradeRoute).toContain(".from('attempt_questions')");
    expect(gradeRoute).toContain(".eq('attempt_id', attempt_id)");
    expect(gradeRoute).toContain(".eq('question_id', question_id)");
    expect(gradeRoute).toContain('Question is not assigned to this attempt');
    expect(gradeRoute).toContain('Assessment eligibility gate not satisfied');
  });

  test('assessment client uses server-assigned questions and never creates a browser-selected assessment set', () => {
    expect(scenarioClient).toContain('loadAssessmentAttemptQuestions(attemptId)');
    expect(scenarioClient).toContain('if (!isAssessmentMode && !state.activeAttempt)');
    expect(scenarioClient).toContain('A server-created assessment attempt is required.');
    expect(scenarioClient).toContain('serverAttemptId: attemptId');
    expect(scenarioClient).toContain('server-assigned assessment question set is not available');
    expect(scenarioClient).toContain('Assessment scoring and finalization are server-controlled and are not enabled in this release.');
  });

  test('grading uses the evidence scenario id rather than the presentation-card id', () => {
    expect(scenarioClient).toContain('scenarioId: evidenceScenarioId');
  });
});