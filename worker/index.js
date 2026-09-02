import { Hono } from "hono";
import { cors } from "hono/cors";
import feedbackRoute from "./routes/torquemind-feedback.js";
import { handleScenarioQuestionsApproved } from "./routes/scenario-questions-approved.js";
import { handleGradeScenarioSubmission } from "./routes/scenario-submissions-grade.js";
import { handleStartAssessmentAttempt } from "./routes/assessment-attempts-start.js";
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Security: Block access to review-only static artifacts
    // These contain draft questions, unapproved sources, and audit artifacts
    // CRITICAL: This must execute BEFORE any env.ASSETS.fetch() or Hono routing
    const blockedAssetPrefixes = [
      '/data/generated/',
      '/data/evidence/source-audit/',
      '/data/evidence/generated-questions/'
    ];

    if (blockedAssetPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      });
    }
    
    return app.fetch(request, env, ctx);
  }
};

export { TorqueMindRateLimitCounter } from './durable-objects/rate-limit-counter.js'
