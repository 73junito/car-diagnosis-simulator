import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("TorqueMind Worker Online"));

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    runtime: "Cloudflare Workers"
  })
);

export default app;
