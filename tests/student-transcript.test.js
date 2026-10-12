const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-transcript.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'student', 'transcript', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'student', 'transcript', 'transcript.js'), 'utf8')

describe('G11 authenticated student transcript', () => {
  test('registers the production Worker transcript route', () => {
    expect(worker).toContain("import { handleStudentTranscript } from \"./routes/student-transcript.js\";")
    expect(worker).toContain("app.get('/api/student/transcript', handleStudentTranscript)")
  })

  test('requires authentication and scopes attempts to the authenticated student', () => {
    expect(route).toContain("extractBearerToken")
    expect(route).toContain("verifySupabaseToken")
    expect(route).toContain(".from('attempts')")
    expect(route).toContain(".eq('user_id', user.id)")
    expect(route).toContain(".from('attempt_answers')")
    expect(route).toContain(".eq('user_id', user.id)")
  })

  test('distinguishes practice, assessment, and unclassified records', () => {
    expect(route).toContain("const ASSESSMENT_MODE = 'independent_non_proctored_assessment'")
    expect(route).toContain("const PRACTICE_MODE = 'training'")
    expect(route).toContain("return 'assessment'")
    expect(route).toContain("return 'practice'")
    expect(route).toContain("return 'unclassified'")
  })

  test('assessment score is exposed only when the server attempt is terminal', () => {
    expect(route).toContain("assessmentScore: terminal && row.score != null ? Number(row.score) : null")
    expect(route).toContain("TERMINAL_STATES")
    expect(ui).toContain("score == null ? 'Not finalized' : score")
  })

  test('practice correctness is reduced to aggregate accuracy rather than answer-level output', () => {
    expect(route).toContain("practiceAccuracyPct: roundPercent(answerSummary.correct, answerSummary.responses)")
    expect(route).not.toContain("studentAnswer:")
    expect(route).not.toContain("correctAnswer:")
    expect(route).not.toContain("answerKey:")
    expect(ui).not.toContain('is_correct')
  })

  test('transcript explicitly disclaims academic credit and credentials', () => {
    expect(route).toContain("academicCredit: false")
    expect(route).toContain("credential: false")
    expect(route).toContain("not an academic transcript, credential, certificate, or record of institutional credit")
    expect(html).toContain("not an academic transcript, credential, certificate, or record of institutional credit")
  })

  test('static certificate and training-hour placeholders are removed', () => {
    expect(html).not.toContain('certificateCount')
    expect(html).not.toContain('trainingHours')
    expect(html).not.toContain('Earned credentials')
    expect(html).not.toContain('Total practice time')
  })

  test('UI uses bearer-authenticated API and truthful empty/error states', () => {
    expect(html).toContain('/auth.js')
    expect(html).toContain('./transcript.js')
    expect(ui).toContain("fetch('/api/student/transcript'")
    expect(ui).toContain("Authorization: 'Bearer ' + accessToken")
    expect(ui).toContain('No practice records are available yet.')
    expect(ui).toContain('No assessment records are available yet.')
    expect(ui).toContain('No server-recorded learning history is available yet.')
    expect(ui).toContain('Practice history is unavailable.')
    expect(ui).toContain('Assessment history is unavailable.')
  })

  test('endpoint does not expose assessment answer keys or per-answer correctness fields', () => {
    expect(route).not.toContain('correct_answer')
    expect(route).not.toContain('explanation')
    expect(route).not.toContain('student_answer')
    expect(route).not.toContain('assessment_question_eligibility')
  })
})
