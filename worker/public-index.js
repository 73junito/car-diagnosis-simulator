/*
 * Public marketing Worker entry point (autolearnpro-public).
 *
 * Least privilege: this surface serves the ./public-site static assets plus
 * minimal health/diagnostics endpoints only. The learner, assessment,
 * instructor, and curriculum-evidence API lives in worker/index.js and is
 * deployed exclusively by autolearnpro-app (see wrangler.app.jsonc).
 *
 * Do not import ./routes/*, ./middleware/*, or ./services/* here.
 * tests/public-worker-least-privilege.spec.js enforces this boundary.
 */
import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    runtime: "Cloudflare Workers"
  })
);

// Lightweight ping for diagnostics
app.get("/__ping", (c) => c.json({ ok: true }));

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};

/*
 * Required by the `durable_objects` binding and `migrations` entry in
 * wrangler.jsonc. The public surface never invokes it — the rate-limit
 * middleware lives only in worker/index.js — but the class must stay exported
 * for as long as the binding exists. Removing it requires a `deleted_classes`
 * migration (which deletes the Durable Object storage) and is therefore a
 * separate, explicitly approved change.
 */
export { TorqueMindRateLimitCounter } from './durable-objects/rate-limit-counter.js';
