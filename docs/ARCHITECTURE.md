# TorqueMind Architecture (working draft)

## Purpose
This document outlines the high-level repository layout, migration status, and conventions for Cloudflare Worker routing, agent placement, and AI metadata storage.

## High-level system
- `worker/` — Cloudflare Worker runtime and routes (target for production).
- `api/` — Vercel Functions (legacy; kept during migration).
- `app/` or `src/` — frontend application code and static assets.
- `database/` and `db/` — schema and persistence related artifacts.

## Directory conventions
- Core application code: `core/`, `engine/`, `services/`.
- Agents and AI: `agents/`, `skills/`, `prompts/` (review before deleting).
- Experimental or legacy: move into `archive/` for long-term history.

## Cloudflare Worker vs Vercel Functions
- Worker is primary runtime for production routes.
- During migration keep `api/` until parity is confirmed.
- Define a route-ownership map in `docs/route-map.md`.

## Agents and AI metadata
- Agent registry: `agents/` (agent manifests, tools, permissions).
- Model registry: `docs/model-registry.md` (placeholder for future work).
- Conversation memory and telemetry: `telemetry/` and `runs/` (archive historic runs before removing).

## Deployment
- Production: Cloudflare Workers + KV/Durable Objects as needed.
- CI: ensure tests run and artifacts are not committed.

## Migration checklist
1. Verify Worker handles all routes.
2. Move `api/` contents to `worker/` or archive.
3. Remove Vercel-specific files (.vercel) after successful cutover.

## Next steps
- Finalize route map and update README.
- Establish `archive/` folder and move legacy artifacts.
- Draft `docs/agent-guidelines.md` describing agent lifecycle.
