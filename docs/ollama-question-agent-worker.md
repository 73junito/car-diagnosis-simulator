# Ollama question agent and generation worker

The GitHub Actions `Generate scenario question drafts` job is the private worker for
development question generation. It reads the `ollama` GitHub Environment secret
`API_GITHUB` as `OLLAMA_API_KEY`; it does not deploy a public route or write to Supabase.

## Responsibilities

| Component | Responsibility |
| --- | --- |
| `scripts/agents/automotive-question-agent.js` | Versioned system instructions, request context, structural/citation checks, and duplicate filtering |
| `scripts/workers/ollama-question-worker.js` | One authenticated Ollama chat request, timeout, JSON parsing, and provider-error sanitization |
| `scripts/generate-scenario-question-drafts.js` | Rights-verified evidence and retained snapshot selection, CLI input checks, draft artifact and governance metadata |
| `.github/workflows/generate-scenario-question-drafts.yml` | Private execution with the environment secret and short-lived artifact upload |

The agent receives both approved evidence excerpts and retained questions. It must
return fewer items when the evidence cannot support distinct, unambiguous questions.
The local duplicate guard rejects near-identical stems and overlapping keyed answers
against retained items and newly accepted drafts. A missing retained snapshot stops
generation. The default snapshot for a scenario is its
`*-complete-items-revision.json` packet, then its `*-human-review-packet.json`
packet. For a new scenario, provide `--retained=<path>` to an explicit JSON
snapshot with `scenario_id` and a `questions` array (which may be empty).

## Review boundary

Every output is a draft. The worker cannot complete citation validation, technical
review, instructional review, or approval. A model instruction and a lexical
duplicate guard cannot prove that a distractor is technically sound or detect every
semantic paraphrase. Human reviewers must inspect the whole item and compare its
learning target with the retained bank before any status change.

## Model selection

The CLI accepts `--model=<ollama-model>`; the GitHub workflow supplies that input.
The same versioned agent instructions are applied to every selected model. The worker
uses Ollama chat JSON mode, and the local validator checks the parsed output. No
model-specific prompt can bypass the agent's fixed system message through the CLI.
