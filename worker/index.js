import { Hono } from "hono";
import feedbackRoute from "./routes/torquemind-feedback.js";
import { createRequestContext } from './middleware/request-context.js'
import { createRateLimitMiddleware } from './middleware/rate-limit.js'

const app = new Hono();

app.get("/", (c) => c.text("TorqueMind Worker Online"));

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    runtime: "Cloudflare Workers"
  })
);

// Lightweight ping for diagnostics
app.get('/__ping', (c) => c.json({ ok: true }));

// attach request context middleware for observability
app.use('/api/torquemind-feedback', createRequestContext())
// attach rate limiting (in-memory store for dev/tests)
app.use('/api/torquemind-feedback', createRateLimitMiddleware())

app.route('/api/torquemind-feedback', feedbackRoute);

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  }
};

export { TorqueMindRateLimitCounter } from './durable-objects/rate-limit-counter.js'
