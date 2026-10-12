import { Hono } from "hono";
import { cors } from "hono/cors";
import feedbackRoute from "./routes/torquemind-feedback.js";
import { handleScenarioQuestionsApproved } from "./routes/scenario-questions-approved.js";
import { handleGradeScenarioSubmission } from "./routes/scenario-submissions-grade.js";
import { handleStartAssessmentAttempt } from "./routes/assessment-attempts-start.js";
import { handleAssessmentAttemptQuestions } from "./routes/assessment-attempt-questions.js";
import { handleStudentRecommendations } from "./routes/student-recommendations.js";
import { handleStudentProgress } from "./routes/student-progress.js";
import { handleStudentTranscript } from "./routes/student-transcript.js";
import { handleStudentActivity } from "./routes/student-activity.js";
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
import {
  handleInstitutionLookup,
  handleInstructorVerificationRequest,
  handleInstructorVerificationStatus,
  handleAdminInstructorVerificationQueue,
  handleAdminInstructorVerificationDecision
} from "./routes/instructor-verification.js";
import { handleInstitutionSearch } from "./routes/institution-search.js";
import {
  handleInstitutionMemberships,
  handleInstitutionPortal
} from "./routes/institution-portal.js";
import {
  handlePlatformAdminInstitutionOwnerInvitation,
  handleInstitutionAdminMembers,
  handleInstitutionAdminInvitations,
  handleInstitutionAdminInvitationDecision,
  handleInstitutionMyInvitations,
  handleInstitutionInvitationAccept,
  handleInstitutionAdminMemberDecision
} from "./routes/institution-membership-admin.js";
import {
  handleInstitutionAdminSettings,
  handleInstitutionAdminDomains,
  handleInstitutionAdminDomainDecision
} from "./routes/institution-settings-domains.js";
import { handleInstitutionAdminReport } from "./routes/institution-reporting.js";
import {
  handlePlatformAdminOverview,
  handlePlatformAdminUsers,
  handlePlatformAdminInstitutions,
  handlePlatformAdminAudit,
  handlePlatformAdminOperationalSettings
} from "./routes/platform-admin-dashboard.js";
import {
  handleStudentInstitutionClaimStatus,
  handleStudentInstitutionClaimQueue,
  handleStudentInstitutionClaimDecision
} from "./routes/student-institution-claims.js";
import {
  handleListClasses,
  handleCreateClass,
  handleFindClassByCode,
  handleEnrollInClass,
  handleClassRoster
} from "./routes/classroom-classes.js";
import { handleCreateAssignment } from "./routes/classroom-assignments.js";
import {
  handleInstructorStudentAnalytics,
  handleInstructorSessionAnalytics,
  handleInstructorAnalyticsExport
} from "./routes/instructor-analytics.js";
import {
  handleInstructorTelemetryHistory,
  handleInstructorTelemetryExport,
  handleInstructorTelemetryStream
} from "./routes/instructor-telemetry.js";
import { handleTelemetryEventIngest } from "./routes/telemetry-ingest.js";
import {
  handleAuthorDrafts,
  handleAuthorDraft,
  handleAuthorDraftReviewRequest,
  handleAuthorDraftPublicationRequest,
  handleAuthorEvidenceSources,
  handleAuthorDraftEvidence,
  handleAuthorDraftEvidenceLink,
  handleAdminAuthorDraftReviews,
  handleAdminAuthorDraftReviewDecision,
  handleAdminAuthorDraftPublications,
  handleAdminAuthorDraftPublicationDecision
} from "./routes/author-drafts.js";
import { createRequestContext } from './middleware/request-context.js'
import { createRateLimitMiddleware } from './middleware/rate-limit.js'
import { orchestrationPersistenceHealth } from './runtime/orchestration-persistence.js'

const app = new Hono();

app.get("/api/health", (c) => {
  const orchestrationPersistence = orchestrationPersistenceHealth(c.env)
  return c.json({
    status: orchestrationPersistence.ok ? "ok" : "degraded",
    runtime: "Cloudflare Workers",
    orchestrationPersistence
  }, orchestrationPersistence.ok ? 200 : 503)
});

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

app.use('/api/student/transcript/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/student/transcript', handleStudentTranscript)

app.use('/api/student/activity/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/student/activity', handleStudentActivity)

app.use('/api/student/institution-claim/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/student/institution-claim/status', handleStudentInstitutionClaimStatus)

// Public institution search for account creation. Results expose only the
// institution identity fields needed for a student or instructor to select
// the correct school; selection itself never proves affiliation.
app.use('/api/institutions/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}))
app.get('/api/institutions/search', handleInstitutionSearch)

const institutionPortalCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/institution/*', institutionPortalCors)
app.get('/api/institution/memberships', handleInstitutionMemberships)
app.get('/api/institution/portal', handleInstitutionPortal)
app.get('/api/institution/admin/members', handleInstitutionAdminMembers)
app.all('/api/institution/admin/invitations', handleInstitutionAdminInvitations)
app.patch('/api/institution/admin/invitations/:invitationId', handleInstitutionAdminInvitationDecision)
app.get('/api/institution/invitations', handleInstitutionMyInvitations)
app.post('/api/institution/invitations/:invitationId/accept', handleInstitutionInvitationAccept)
app.patch('/api/institution/admin/members/:membershipId', handleInstitutionAdminMemberDecision)
app.all('/api/institution/admin/settings', handleInstitutionAdminSettings)
app.all('/api/institution/admin/domains', handleInstitutionAdminDomains)
app.patch('/api/institution/admin/domains/:domain', handleInstitutionAdminDomainDecision)
app.get('/api/institution/admin/report', handleInstitutionAdminReport)
app.get('/api/institution/admin/student-claims', handleStudentInstitutionClaimQueue)
app.patch('/api/institution/admin/student-claims/:userId', handleStudentInstitutionClaimDecision)

app.use('/api/admin/institutions/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.post('/api/admin/institutions/owner-invitations', handlePlatformAdminInstitutionOwnerInvitation)

app.use('/api/admin/platform/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/admin/platform/overview', handlePlatformAdminOverview)
app.get('/api/admin/platform/users', handlePlatformAdminUsers)
app.get('/api/admin/platform/institutions', handlePlatformAdminInstitutions)
app.get('/api/admin/platform/audit', handlePlatformAdminAudit)
app.all('/api/admin/platform/operational-settings', handlePlatformAdminOperationalSettings)

// Instructor institution verification. Federal School Code resolves the institution,
// while a separate affiliation review controls instructor authorization.
app.use('/api/instructor/verification/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/instructor/verification/institution', handleInstitutionLookup)
app.post('/api/instructor/verification/request', handleInstructorVerificationRequest)
app.get('/api/instructor/verification/status', handleInstructorVerificationStatus)

// Admin-only instructor affiliation review. The Worker authorizes the reviewer;
// the database trigger appends immutable audit evidence for every final decision.
app.use('/api/admin/instructor-verification/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/admin/instructor-verification/requests', handleAdminInstructorVerificationQueue)
app.patch('/api/admin/instructor-verification/requests/:requestId', handleAdminInstructorVerificationDecision)

app.use('/api/admin/student-institution-claims/*', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.get('/api/admin/student-institution-claims', handleStudentInstitutionClaimQueue)
app.patch('/api/admin/student-institution-claims/:userId', handleStudentInstitutionClaimDecision)

// Instructor-owned classroom core. The Worker verifies the bearer token and
// trusted instructor role, then scopes all persistence to the authenticated owner.
const classroomCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/classes', classroomCors)
app.use('/api/classes/*', classroomCors)
app.use('/api/assign', classroomCors)
app.get('/api/classes', handleListClasses)
app.post('/api/classes', handleCreateClass)
app.get('/api/classes/by-code/:code', handleFindClassByCode)
app.post('/api/classes/:classId/enroll', handleEnrollInClass)
app.get('/api/classes/:classId/students', handleClassRoster)
app.post('/api/assign', handleCreateAssignment)

const instructorAnalyticsCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/analytics/students', instructorAnalyticsCors)
app.use('/api/analytics/sessions', instructorAnalyticsCors)
app.use('/api/analytics/export', instructorAnalyticsCors)
app.get('/api/analytics/students', handleInstructorStudentAnalytics)
app.get('/api/analytics/sessions', handleInstructorSessionAnalytics)
app.get('/api/analytics/export', handleInstructorAnalyticsExport)

const instructorTelemetryCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/telemetry/history', instructorTelemetryCors)
app.use('/api/telemetry/export.:format', instructorTelemetryCors)
app.use('/api/telemetry/stream', instructorTelemetryCors)
app.get('/api/telemetry/history', handleInstructorTelemetryHistory)
app.get('/api/telemetry/export.:format', handleInstructorTelemetryExport)
app.get('/api/telemetry/stream', handleInstructorTelemetryStream)

app.use('/api/telemetry/events', cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
app.post('/api/telemetry/events', handleTelemetryEventIngest)

const authorDraftCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/author/drafts', authorDraftCors)
app.use('/api/author/drafts/*', authorDraftCors)
app.use('/api/author/evidence-sources', authorDraftCors)
app.all('/api/author/drafts', handleAuthorDrafts)
app.all('/api/author/drafts/:draftId', handleAuthorDraft)
app.post('/api/author/drafts/:draftId/review-request', handleAuthorDraftReviewRequest)
app.post('/api/author/drafts/:draftId/publication-request', handleAuthorDraftPublicationRequest)
app.get('/api/author/evidence-sources', handleAuthorEvidenceSources)
app.all('/api/author/drafts/:draftId/evidence', handleAuthorDraftEvidence)
app.delete('/api/author/drafts/:draftId/evidence/:linkId', handleAuthorDraftEvidenceLink)

const adminAuthorReviewCors = cors({
  origin: 'https://app.autolearnpro.com',
  allowMethods: ['GET', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
})
app.use('/api/admin/author-drafts/reviews', adminAuthorReviewCors)
app.use('/api/admin/author-drafts/reviews/*', adminAuthorReviewCors)
app.get('/api/admin/author-drafts/reviews', handleAdminAuthorDraftReviews)
app.patch('/api/admin/author-drafts/reviews/:draftId', handleAdminAuthorDraftReviewDecision)
app.use('/api/admin/author-drafts/publications', adminAuthorReviewCors)
app.use('/api/admin/author-drafts/publications/*', adminAuthorReviewCors)
app.get('/api/admin/author-drafts/publications', handleAdminAuthorDraftPublications)
app.patch('/api/admin/author-drafts/publications/:draftId', handleAdminAuthorDraftPublicationDecision)

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
  allowHeaders: ['Content-Type', 'Authorization'],
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
