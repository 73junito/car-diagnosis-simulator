# Ollama Tunnel & Cloudflare Access design for TorqueMind

This document describes the recommended architecture and rollout plan for using a Cloudflare Tunnel + Cloudflare Access to reach a local Ollama server from the TorqueMind Worker.

## Goals
- Avoid Ollama Cloud costs by using local Ollama models (e.g. `gpt-oss:20b`).
- Keep Worker-to-Ollama traffic authenticated and auditable.
- Preserve existing Durable Object rate limiting, request IDs, and tutor validation.

## Architecture

TorqueMind users
      │
      ▼
Cloudflare Worker (request validation, rate limiting, structured logging)
      │
      ▼
Cloudflare Access (service token)
      │
      ▼
Cloudflare Tunnel (`cloudflared`) forwarding
      │
      ▼
Local Ollama server
      │
      ▼
Local models (gpt-oss:20b, qwen, embedding models)

The Worker must not call `https://ollama.com/api/chat`. Instead the Worker should call a protected hostname such as:

```
https://ollama.yourdomain.com/api/chat
```

That hostname is a Cloudflare-managed hostname that tunnels to `http://127.0.0.1:11434` (the local Ollama HTTP API).

## Authentication between Worker and Ollama

- Use Cloudflare Access service tokens. Set the following Worker secrets (never checked into `wrangler.jsonc`):
  - `OLLAMA_ACCESS_CLIENT_ID`
  - `OLLAMA_ACCESS_CLIENT_SECRET`

- The Worker sends the Access credentials as headers on requests to the tunneled hostname:

```
headers: {
  "content-type": "application/json",
  "CF-Access-Client-Id": OLLAMA_ACCESS_CLIENT_ID,
  "CF-Access-Client-Secret": OLLAMA_ACCESS_CLIENT_SECRET
}
```

- Backwards compatibility: if the project is using Ollama Cloud bearer tokens (`TORQUEMIND_AI_API_KEY`) the adapter should still support that mode; when both modes are present, Access credentials MUST take precedence.

## Environment contract

Local development (non-tunneled):

```
TORQUEMIND_AI_PROVIDER=ollama
TORQUEMIND_AI_URL=http://127.0.0.1:11434/api/chat
TORQUEMIND_AI_MODEL=gpt-oss:20b
TORQUEMIND_AI_TIMEOUT_MS=120000
```

Cloudflare staging (tunneled hostname + Access secrets stored as Worker secrets):

```
TORQUEMIND_AI_PROVIDER=ollama
TORQUEMIND_AI_URL=https://ollama.yourdomain.com/api/chat
TORQUEMIND_AI_MODEL=gpt-oss:20b
TORQUEMIND_AI_TIMEOUT_MS=120000
OLLAMA_ACCESS_CLIENT_ID: (Worker secret)
OLLAMA_ACCESS_CLIENT_SECRET: (Worker secret)
```

Do not commit the real tunnel hostname into the repository until the Cloudflare Access application and tunnel are provisioned. Use the docs and staged configuration first; perform the environment switch in a follow-up rollout commit.

## Request body contract

Because the Ollama endpoint is `/api/chat`, the request body should use `messages` (not `input`):

```
body: JSON.stringify({
  model: TORQUEMIND_AI_MODEL,
  messages: [ { role: 'user', content: prompt } ],
  stream: false
})
```

## Worker adapter behavior

- Build headers defensively and do not expose secrets in logs.
- If both `OLLAMA_ACCESS_CLIENT_ID` and `OLLAMA_ACCESS_CLIENT_SECRET` are configured, send those headers.
- Else if `TORQUEMIND_AI_API_KEY` is configured, send `Authorization: Bearer <key>`.
- Access authentication takes precedence over bearer API key.

## Validation & tests (required)

- Access headers present when both secrets configured.
- Bearer authentication remains available for Ollama Cloud.
- Access authentication takes precedence when both modes present.
- Secrets must never appear in logs or returned errors.
- Missing one of the two Access credentials fails configuration validation in staging.
- Existing response extraction and tutor-schema validation must remain unchanged.

## Rollout plan

1. Add documentation and adapter changes (this PR). Keep PR #332 open and unmerged.
2. Provision Cloudflare Tunnel and Access application for the staging hostname.
3. Add Worker secrets for `OLLAMA_ACCESS_CLIENT_ID` and `OLLAMA_ACCESS_CLIENT_SECRET`.
4. Flip `TORQUEMIND_AI_URL` in staging to `https://ollama.yourdomain.com/api/chat` and verify Worker returns HTTP 200.
5. Monitor for availability and increase availability by moving Ollama to an always-on host if needed.

## Operational limitations

- Ollama and `cloudflared` must be running on the target machine.
- The machine must not be asleep; uptime matters.
- GPU, memory, and upload bandwidth will affect response times.
- Consider a 120s Worker timeout during rollout.

## RALA separation

Keep RALA chunk completion as a separate workstream and do not bundle it into this infra rollout.
