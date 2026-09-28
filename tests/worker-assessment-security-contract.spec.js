const fs = require('fs');
const path = require('path');

describe('Cloudflare Worker assessment security contract', () => {
  const root = path.join(__dirname, '..');
  const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8');
  const gradeRoute = fs.readFileSync(path.join(root, 'worker/routes/scenario-submissions-grade.js'), 'utf8');
  const scenarioClient = fs.readFileSync(path.join(root, 'dashboard/student/scenario/scenario.js'), 'utf8');

  test('Worker is the canonical production grading route', () => {
    expect(workerIndex).toContain("app.post('/api/scenario-submissions/grade', handleGradeScenarioSubmission)");
    expect(workerIndex).toContain("./routes/scenario-submissions-grade.js");
  });

  test('grading loads server-authoritative attempt scenario and status', () => {
    expect(gradeRoute).toContain("id, user_id, scenario, delivery_mode, status, payload_json");
  });

  test('rejects submissions to completed or abandoned attempts', () => {
    expect(gradeRoute).toContain("attempt.status !== 'active'");
    expect(gradeRoute).toContain("Attempt is not active");
  });

  test('rejects a scenario that does not match the attempt', () => {
    expect(gradeRoute).toContain('attempt.scenario !== scenario_id');
    expect(gradeRoute).toContain('Attempt does not belong to this scenario');
  });

  test('requires authenticated ownership and matching delivery mode', () => {
    expect(gradeRoute).toContain('attempt.user_id !== userId');
    expect(gradeRoute).toContain('attempt.delivery_mode !== delivery_mode');
  });

  test('assessment mode suppresses correctness feedback and AI assistance', () => {
    expect(gradeRoute).toContain("if (delivery_mode === 'training')");
    expect(gradeRoute).toContain("attempt.delivery_mode !== 'independent_non_proctored_assessment'");
    expect(gradeRoute).toContain('aiAssistanceAllowed === true');
  });
  test('scenario grading client sends the authenticated Bearer token', () => {
    expect(scenarioClient).toContain('function getAuthToken()');
    expect(scenarioClient).toContain('supabase_access_token');
    expect(scenarioClient).toContain("'Authorization': `Bearer ${authToken}`");
    expect(scenarioClient).toContain('Authentication required to submit a graded response.');
  });

});
