import { Hono } from "hono";
import { cors } from "hono/cors";
import feedbackRoute from "./routes/torquemind-feedback.js";
import { handleScenarioQuestionsApproved } from "./routes/scenario-questions-approved.js";
import { handleGradeScenarioSubmission } from "./routes/scenario-submissions-grade.js";
import { handleStartAssessmentAttempt } from "./routes/assessment-attempts-start.js";
import { handleAssessmentAttemptQuestions } from "./routes/assessment-attempt-questions.js";
import { handleStudentRecommendations } from "./routes/student-recommendations.js";
import { handleStudentProgress } from "./routes/student-progress.js";
import { handleCurriculumRead } from "./routes/curriculum-read.js";
import { handleCurriculumReferences } from "./routes/curriculum-references.js";
import {
  handleSemanticScholarSearch,
  handleSemanticScholarPaper
} from "./routes/semantic-scholar-research.js";
import {
  handleCurriculumEvidenceGaps,
  handleCurriculumEvidenceRecords,
  handleCurriculumApprovedSources,
  handleCurriculumApprovedSourceRightsReview,
  handleCurriculumEvidenceRecordReview
} from "./routes/curriculum-evidence.js";
import {
  handleCurriculumEnhancementDrafts,
  handleCurriculumEnhancementDraftReview
} from "./routes/curriculum-enhancements.js";
import { createRequestContext } from './middleware/request-context.js'
import { createRateLimitMiddleware } from './middleware/rate-limit.js'

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    runtime: "Cloudflare Workers"
  })
);

// Lightweight ping for diagnostics
app.get('/__ping', (c) => c.json({ ok: true }));

app.use('/api/torquemind-feedback/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}))
// attach request context middleware for observability
app.use('/api/torquemind-feedback', createRequestContext())
// attach rate limiting (in-memory store for dev/tests)
app.use('/api/torquemind-feedback', createRateLimitMiddleware())

app.route('/api/torquemind-feedback', feedbackRoute);

// TTED805: New assessment endpoints with CORS and auth support
app.use('/api/scenario-questions-approved/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}))
app.get('/api/scenario-questions-approved', handleScenarioQuestionsApproved)

app.use('/api/scenario-submissions/grade/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.post('/api/scenario-submissions/grade', handleGradeScenarioSubmission)

app.use('/api/assessment-attempts/start/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.post('/api/assessment-attempts/start', handleStartAssessmentAttempt)

app.use('/api/assessment-attempts/:attempt_id/questions/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/assessment-attempts/:attempt_id/questions', handleAssessmentAttemptQuestions)

app.use('/api/student/recommendations/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/student/recommendations', handleStudentRecommendations)

app.use('/api/student/progress/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/student/progress', handleStudentProgress)

// Curriculum read API: server-side service-role read boundary for the
// curriculum tables. Response mirrors the static data/curriculum contract.
// The exam site (exam.autolearnpro.com) consumes it cross-origin; the
// static JSON remains the fallback source.
app.use('/api/curriculum/*', cors({
  origin: [
    'https://app.autolearnpro.com',
    'https://exam.autolearnpro.com'
  ],
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}))
app.all('/api/curriculum', handleCurriculumRead)
app.get('/api/curriculum/references', handleCurriculumReferences)

// Semantic Scholar research discovery: server-side, authenticated, and role-restricted.
// The API key is a Worker secret and is never returned to clients.
app.use('/api/research/semantic-scholar/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/research/semantic-scholar/search', handleSemanticScholarSearch)
app.get('/api/research/semantic-scholar/paper/:paperId', handleSemanticScholarPaper)

// Curriculum evidence-gap persistence: authenticated instructor research workflow only.
// Writes remain server-side through the service role and cannot grant assessment eligibility.
app.use('/api/research/curriculum-evidence/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.all('/api/research/curriculum-evidence/gaps', handleCurriculumEvidenceGaps)
app.all('/api/research/curriculum-evidence/records', handleCurriculumEvidenceRecords)
app.get('/api/research/curriculum-evidence/approved-sources', handleCurriculumApprovedSources)
app.patch('/api/research/curriculum-evidence/approved-sources/:sourceId/rights', handleCurriculumApprovedSourceRightsReview)
app.patch('/api/research/curriculum-evidence/records/:evidenceId', handleCurriculumEvidenceRecordReview)
app.all('/api/research/curriculum-enhancements/drafts', handleCurriculumEnhancementDrafts)
app.patch('/api/research/curriculum-enhancements/drafts/:draftId', handleCurriculumEnhancementDraftReview)

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  }
};

export { TorqueMindRateLimitCounter } from './durable-objects/rate-limit-counter.js'
