# AutoLearn Pro Subprocessor and External Processing Register

Status: P0.2 governance baseline
Verified: 2026-09-29
Change type: documentation/governance/validation only

## Purpose

This register identifies external infrastructure and AI services that currently process, may process, or are technically capable of receiving AutoLearn Pro student-related data.

Public vendor statements are evidence inputs, not substitutes for account-level contract verification. A service is not approved for new student-data processing merely because it appears in this register.

## Status model

| Status | Meaning |
| --- | --- |
| active_required | Confirmed current infrastructure path needed for the product. |
| active_conditional | Code/config indicates a current or probable processing path, but a deployment/account fact still requires verification. |
| supported_not_approved | Code supports the provider type, but it is not approved to receive student data until a named provider is reviewed and registered. |
| non_student_only | Service exists in the codebase but is not approved for student records or student-generated educational content. |
| review_required | Processing purpose, contract, retention, training use, routing, or deletion evidence is incomplete. |

## Current register

| ID | Provider / service | Role | Student-related data | Current status | Required control |
| --- | --- | --- | --- | --- | --- |
| SPR-001 | Cloudflare | Worker/API hosting, edge transport, request/security metadata; optional Access layer for AI gateway | HTTP request/response content transiting Worker routes; end-user request metadata; tutor requests when routed through Worker | active_required | Maintain applicable DPA/service-provider terms; review logs/analytics and data-location configuration; do not put authentication secrets or unnecessary student content into logs. |
| SPR-002 | Supabase | Authentication, PostgreSQL database, REST/API services | account identifiers/email/role; attempts, answers, scores, telemetry, and other student-linked records described by the student-data inventory | active_required | Maintain DPA; document region; restrict service-role credentials; enforce RLS/access controls; include exports, backups, and deletion behavior in retention contract. |
| SPR-003 | ollama.autolearnpro.com | Operator-controlled AI inference gateway/front door | training-mode scenario/question context, student answer, topic, model request metadata | active_conditional + review_required | Verify hosting/routing owner, logging, retention, Access configuration, and downstream provider before institutional student data is authorized. |
| SPR-004 | Ollama Cloud | Probable downstream model compute for configured gpt-oss:20b-cloud model | prompt content and generated response if the gateway uses Ollama Cloud | active_conditional + review_required | Confirm account-level routing and contractual terms. Public policy says cloud prompts/responses are transient and not used for training; retain evidence and confirm institutional acceptability before launch. |
| SPR-005 | Generic openai-compatible provider | Alternate AI inference integration supported in code | would receive the same tutor prompt content as SPR-003 if configured | supported_not_approved | A named provider must be added to this register with DPA/retention/training/deletion review before any student data is sent. No wildcard approval. |
| SPR-006 | Resend / SendGrid pilot notification path | Sends pilot-request business contact notifications | pilot contact name, email, district, notes; not an approved student-record flow | non_student_only | Keep pilot intake separate from student records. Do not place student answers, grades, rosters, assessment data, or other student-restricted content in this notification path without separate review. |

## Student-data transfer boundaries

### Cloudflare

AutoLearn Pro runs API routes on Cloudflare Workers, so student-related request content transits Cloudflare infrastructure when users interact with the application. Cloudflare also processes end-user request/log metadata associated with the service.

The register does not authorize sending additional student content to Cloudflare logs, analytics, or optional services. Product logging should remain metadata-minimized.

### Supabase

Supabase is the confirmed system of record for authentication and multiple student-linked database assets. Current vendor documentation states that Supabase acts as processor/service provider for customer data under its DPA and can engage listed subprocessors under that agreement.

The P0.3 retention/deletion contract must reconcile AutoLearn Pro deletion requirements with database rows, auth identities, backups, exports, and the provider's account-level deletion behavior.

### AI inference

The current production Worker configuration selects provider type `ollama`, endpoint `https://ollama.autolearnpro.com/api/chat`, and model `gpt-oss:20b-cloud`.

That configuration proves the application sends prompts to the operator-controlled endpoint. It does not by itself prove the final compute provider or full routing chain. The cloud-model name is consistent with Ollama Cloud, so Ollama Cloud is entered as a probable downstream processor with verification required.

Training-mode prompts can contain student-generated answers. Official assessment mode rejects tutor access before any provider call.

### Generic OpenAI-compatible path

The code permits an `openai-compatible` provider type. That is a technical capability, not approval for OpenAI or any other vendor. The application must fail governance review if a deployment attempts to send student data to a named provider that is absent from this register.

## Data-use invariants

1. No subprocessor may use identifiable student records for its own advertising or unrelated commercial purpose.
2. No provider may train on identifiable AutoLearn Pro student content unless separately approved through legal, institutional, privacy, and product-governance review.
3. An AI provider's public no-training statement does not replace a required institution contract or DPA.
4. Student answer content is never classified as ordinary anonymous telemetry merely because it is sent transiently.
5. A provider switch requires register review before production student traffic is enabled.
6. Wildcard provider categories such as `openai-compatible` are not sufficient authorization.
7. API keys, service-role keys, Access credentials, tokens, and other authentication secrets must never be entered into this register or application telemetry.
8. Vendor support tickets must not include student prompts/responses unless specifically authorized and appropriately redacted.
9. Provider logs and observability should record only the minimum metadata needed for security and operations.
10. If routing/retention/training facts cannot be verified, the provider remains `review_required`.

## Required account-level evidence before institutional launch

| Provider | Evidence still required |
| --- | --- |
| Cloudflare | Applicable account agreement/DPA status; enabled logging/analytics products; retention settings; relevant data-location configuration; subprocessor notification process. |
| Supabase | Applicable DPA status; production project region; backup/log retention settings; deletion/export procedures; subprocessor notification process. |
| AI gateway | Hosting owner; DNS/origin routing; Cloudflare Access usage if any; gateway logs; request/response retention; deletion mechanism. |
| Ollama Cloud if confirmed | Account/plan identity; applicable terms or enterprise/DPA documentation where required; model hosting regions; no-training/retention evidence retained with procurement records; subprocessor/hosting chain. |
| Any openai-compatible provider | Named legal entity; endpoint; DPA/service-provider terms; data fields; retention; training use; region; subprocessors; deletion; breach notification; institution approval. |

## Non-student service boundary

The pilot-request notification feature may send prospective customer/business-contact information through Resend or SendGrid. That feature is not an approved path for student records. If a future workflow combines pilot/contact intake with identifiable students, it requires a new inventory and subprocessor review before production use.

## Official vendor evidence reviewed

- Cloudflare Data Processing Addendum: https://www.cloudflare.com/cloudflare-customer-dpa/
- Cloudflare subprocessors: https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/
- Supabase Data Processing Addendum: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase subprocessor list: https://supabase.com/legal/customer-resources/subprocessor-list
- Ollama Privacy Policy: https://ollama.com/privacy
- Ollama cloud-model information: https://ollama.com/blog/cloud-models
- Ollama pricing/privacy FAQ: https://ollama.com/pricing

## Next P0 slice

P0.3 should define the retention/deletion contract using this register and the student-data inventory together. No retention period should be inferred from a vendor default when AutoLearn Pro or an institution requires a shorter period.
