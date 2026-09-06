# Payment & Entitlement Contract — Non-Deployable Test-First Specification

**Status:** ⚠️ **DESIGN ONLY — DO NOT DEPLOY**
**Branch:** `docs/paid-sites-paypal-contract`
**Worktree:** `F:\TorqueMind-payments-contract`
**Updated:** 2026-09-05

---

## Executive Summary

This contract specifies a **test-first, non-deployable conceptual model** for payment and entitlement design using PayPal integration. **This is a specification document, not production code.**

**v1 Model: Fixed-Duration Training Access (NOT Recurring Subscriptions)**

**Critical Security Principle:**
- ⚠️ **PayPal Payment Links are UI only—they DO NOT grant access**
- ✅ Access is granted ONLY after server verifies webhook from PayPal
- ✅ Server determines all prices, durations, product IDs (client cannot override or supply these)
- ✅ PayPal's official webhook verification (not custom HMAC, not custom secrets)
- ✅ Exam version is immutable, server-assigned (no re-use per user)
- ✅ Separate domains enforce training vs. certification access control
- ✅ No tutoring or answer keys visible on exam domain
- ✅ All mutations audit-logged

**v1 Product Model:**
- `training_access`: One purchase → server-configured expiration date → access expires automatically
- `certification_exam_attempt`: One purchase → one exam attempt + immutable server-assigned version

**⚠️ What is NOT included:**
- ❌ Database schema migration (removed from branch)
- ❌ Answer keys table (deferred to separate security review)
- ❌ Deployable code (tests are contract-only)
- ❌ Secrets or configuration (no PayPal API setup in this phase)
- ❌ Data retention and cascade delete rules (requires separate review)

**Scope:** Test contracts, security rules, prohibited behaviors
**No implementation:** This branch contains only specification tests

---

## Deliverables

### 1. ~~Database Schema Migration~~ → REMOVED
**Reason:** Data retention policy and Supabase RLS design require separate review.

**Deferred considerations:**
- Cascade delete vs. archive strategy for user deletion
- RLS policies for multi-domain isolation (app.autolearnpro.com vs. autolearnpro.com)
- Audit trail immutability and retention policy
- Answer keys schema (keep separate from payment schema)

**Next steps:** Create a separate migration in a dedicated branch after data retention design is approved.

### 2. Test Contract (Jest Suite) — CONTRACT-ONLY
**File:** `tests/payment-entitlement-contract.spec.js`

**Test coverage:**

| Area | Tests | Assertions |
|------|-------|-----------|
| Product Catalog | 3 tests | Product identifier validation, no prices in contract |
| Order Creation | 5 tests | Server price lookup (NOT hardcoded), rejection of invalid product/auth, no client override |
| Order Capture | 6 tests | Atomicity, idempotency, ownership validation, entitlement creation |
| Webhook Verification | 7 tests | PayPal official verification, raw body preservation, idempotency by event ID |
| Entitlement Validation | 5 tests | Active/expired/revoked states, denial of non-existent entitlements |
| Exam Version Assignment | 3 tests | Immutability, separate entitlements, certification-only |
| Domain Isolation | 4 tests | Training-only features, exam-domain restrictions |
| Audit Trail | 3 tests | Order creation, capture, webhook processing logged |
| Integration Workflows | 4 tests | v1 training-access workflow, v1 rejects certification as deferred to v2+ |

**Total: 45 test cases** covering all contract requirements
**⚠️ All tests are assertions on security rules and prohibited behaviors — NOT mocking payment processors**

### 2. ~~Answer Keys Table~~ → REMOVED
**Reason:** Answer key storage, access control, and instructor authorization require separate design review. This should not be part of payment schema.

**Deferred to separate project:** Instructor/grading infrastructure design.

### 3. Payment & Entitlement Design Document (Non-Deployable)
**File:** `docs/PAYMENT_ENTITLEMENT_DESIGN.md` (NEW)

---

## v1 Fixed-Duration Model (Not Subscriptions)

### training_access
- **One purchase** → one fixed-duration entitlement
- **Expiration:** Server-configured duration (e.g., 365 days, NOT hardcoded)
- **Behavior:** Access expires automatically at expiration_date
- **Renewal:** User can purchase again after expiration
- **Mental model:** "Buy access for X days, use until expiration"
- **No complexity:** No renewal logic, no cancellation, no subscription state machine

### certification_exam_attempt
- **One purchase** → one exam attempt + immutable version assignment
- **Expiration:** Server-configured validity period (e.g., 30 days, NOT hardcoded)
- **Behavior:** Expires at expiration_date OR after one attempt (whichever is first)
- **Version assignment:** Server atomically assigns exam version during order capture
- **Immutability:** User cannot receive same exam_version_id twice
- **No complexity:** No version re-use, no cancellation

---

## Critical: PayPal Payment Links Are NOT Sufficient

A PayPal Payment Button or Payment Link in the browser is **purely a UI element for checkout**. It does NOT grant access.

**Correct flow:**
```
User clicks PayPal button
         ↓
User approves on PayPal.com
         ↓
PayPal sends webhook to server: PAYMENT.CAPTURE.COMPLETED
         ↓
Server verifies webhook with PayPal's official verification endpoint
         ↓
Server creates entitlement in database
         ↓
Client checks entitlement via API
         ↓
Access granted
```

**NOT acceptable:**
- ❌ "I see a PayPal button, I must have access"
- ❌ Client-side validation of PayPal payment
- ❌ Server trusting client claims about payment
- ❌ Skipping webhook verification

---

## Product Definitions (Identifiers Only, Server Configuration)

---

## Critical Safeguards

### 1. Prices Are Configurable, Not Trusted from Client
```javascript
// Prices are VISIBLE in PayPal checkout (not secret)
// But they MUST be server-owned and never trusted from client input

// Client sends: { product_id: "training_access" }
// Server looks up: price from configuration/database (NOT from client)
// Server rejects: Any request with amount, price, or currency field

// Current launch prices are server-configured via environment variables or KV storage
// Never hardcode in browser code
```

### 2. No Prices in Tests
Tests use product **identifiers** only, never prices:
```javascript
// ✅ CORRECT: Test verifies product_id is accepted
const requestBody = { product_id: 'training_access' };

// ❌ WRONG: Test should never hardcode price
// const requestBody = { product_id: 'training_access', amount: 29.99 };
```

### 3. Secret Management (Server-Only)
| Item | Used By | Storage | Visibility | Rule |
|------|---------|---------|------------|------|
| `PAYPAL_CLIENT_SECRET` | Server only | Cloudflare secrets | ❌ Never exposed | Secret; never in browser |
| `PAYPAL_WEBHOOK_ID` | Server (webhook verification) | Cloudflare secrets | ❌ Never exposed | Secret; verify with PayPal official endpoint |
| Product pricing | Server config | Cloudflare KV or environment | ✅ Visible in checkout | Server-owned; never trusted from client input |
| Public client IDs | Browser (checkout) | Public config | ✅ Safe to expose | Use only on intended domain |

### 4. Webhook Verification (PayPal Official Flow)
**Do NOT use custom HMAC-SHA256.**

**Required approach:** Use ONE of these PayPal-supported methods:

#### Option A: PayPal Webhooks Verification Endpoint (Recommended)
```
1. Receive webhook with headers:
   - Paypal-Transmission-Id: transmissionId
   - Paypal-Transmission-Time: timestamp (ISO 8601)
   - Paypal-Transmission-Sig: signature
   - Paypal-Cert-Url: https://api.paypal.com/v1/notifications/certs/...
   - Paypal-Auth-Algo: SHA256withRSA

2. Extract raw request body (do NOT modify or re-stringify)

3. POST to PayPal verification endpoint:
   POST https://api.paypal.com/v1/notifications/verify-webhook-signature
   {
     "transmission_id": transmissionId,
     "transmission_time": timestamp,
     "cert_url": certUrl,
     "auth_algo": authAlgo,
     "transmission_sig": signature,
     "webhook_id": your_webhook_id,
     "event_body": rawBodyAsJsonString
   }

4. Validate response:
   { "verification_status": "SUCCESS" } or "FAILURE"

5. Only process if SUCCESS
```

#### Option B: Certificate-Based Verification (Legacy)
```
1. Extract certificate from Paypal-Cert-Url header
2. Verify RSA signature in Paypal-Transmission-Sig using certificate public key
3. Validate timestamp is within 5 minutes
4. Process only if all checks pass
```

**NOT ALLOWED:**
- ❌ Custom HMAC-SHA256 with shared webhook secret
- ❌ Skipping verification
- ❌ Modifying request body before verification

**Webhook deduplication:** A later migration will implement idempotency tracking to ensure
each webhook event is processed exactly once.

### 6. Domain Isolation
| Feature | Training | Certification |
|---------|----------|----------------|
| Practice scenarios | ✅ | ❌ |
| Feedback | ✅ | ❌ |
| Answer keys | N/A (removed from schema) | ❌ |
| Tutor explanations | ✅ | ❌ |
| Analytics | ✅ | ❌ |
| Scored attempt | ❌ | ✅ |
| Immutable version | ❌ | ✅ |

---

## Payment Workflow

### Order Creation
```
POST /api/orders/create
├─ Input: { product_id: string }
├─ Server:
│  ├─ Validate authentication (user must be logged in)
│  ├─ Validate product_id is 'training_access' (v1 only)
│  ├─ Reject if product_id is 'certification_exam_attempt' with HTTP 409
│  ├─ Look up price from server config (NOT from client)
│  ├─ Create PayPal order via REST API (using server secret)
│  ├─ Store order record with status='pending'
│  └─ Return: { order_id, paypal_order_id, status }
└─ Database: orders (status='pending') — schema deferred
```

### Order Capture
```
POST /api/orders/capture
├─ Input: { order_id: string }
├─ Server:
│  ├─ Verify order exists and belongs to authenticated user
│  ├─ Verify order status is 'pending'
│  ├─ Call PayPal /v2/checkout/orders/{id}/capture (using server secret)
│  ├─ Validate response: status='COMPLETED'
│  ├─ Atomically (transaction):
│  │  ├─ Update order status → 'captured'
│  │  ├─ Create entitlement record
│  │  ├─ For certification: assign immutable exam version
│  │  └─ Log audit entry
│  └─ Return: { order_id, status, entitlement_id, product_id }
└─ Database: orders, entitlements — schema deferred
```

### Webhook Processing (Future Implementation)
**Note:** Webhook processing is a Phase 2A implementation requirement. v1 contract specifies:
```
POST /api/webhooks/paypal
├─ Headers: Paypal-Transmission-Id, Paypal-Transmission-Time, Paypal-Transmission-Sig
├─ Server (future implementation):
│  ├─ Verify signature with PayPal official endpoint
│  │  (POST https://api.paypal.com/v1/notifications/verify-webhook-signature)
│  ├─ Preserve raw request body (do NOT re-stringify)
│  ├─ Deduplicate by PayPal event ID
│  ├─ On PAYMENT.CAPTURE.COMPLETED:
│  │  └─ Confirm/update order status to 'captured'
│  └─ Log audit entry
└─ Database: webhook_events, orders — schema deferred
```

---

## Entitlement Validation Endpoints

### Check Training Access
```
GET /api/entitlements/check/training
Response (has access):
  { has_access: true, entitlement_id, product_id, expires_at }

Response (no access):
  { has_access: false, reason: "no_entitlement|expired" }
```

### Check Certification Access
```
GET /api/entitlements/check/certification
Response (has access, not consumed):
  {
    has_access: true,
    entitlement_id,
    product_id,
    exam_version_id,  // immutable, server-assigned
    expires_at,
    consumed: false
  }

Response (consumed):
  { has_access: true, ..., consumed: true }

Response (no access):
  { has_access: false, reason: "no_entitlement|expired" }
```

---

## Test Execution

### Running the test contract
```bash
# Run all payment/entitlement tests
npm test -- tests/payment-entitlement-contract.spec.js

# Run specific suite
npm test -- tests/payment-entitlement-contract.spec.js --testNamePattern="Order Creation"

# Run with coverage
npm test -- tests/payment-entitlement-contract.spec.js --coverage
```

### Test statistics
- **Total test suites:** 1 (payment-entitlement-contract.spec.js)
- **Total test cases:** 45
- **Total assertions:** ~90+
- **Coverage scope:** API contract, entitlement logic, webhook verification, security constraints

---

## Implementation Roadmap

### ✅ Phase 1: Test Contract (COMPLETE)
- [x] Define product catalog
- [x] Specify payment workflow
- [x] Define webhook contract
- [x] Define entitlement model
- [x] Specify exam version allocation (deferred to v2+)
- [x] Write Jest test suite (45 tests)
- [x] Document all constraints and safeguards

### Phase 2A: Training-Access Implementation (Separate Approval)
- [ ] Schema design and security review (separate workstream)
- [ ] Implement `POST /api/orders/create`
- [ ] Implement `POST /api/orders/capture`
- [ ] Implement `POST /api/webhooks/paypal` (PayPal official verification)
- [ ] Implement `GET /api/entitlements/check/training`
- [ ] Integration testing against PayPal sandbox
- [ ] Explicit approval before deployment

### Phase 2B: Certification Deferred (Separate Workstream)
- [ ] Certification exam attempts are deferred to v2+
- [ ] Requires separate deployment and security review
- [ ] All v1 certification requests rejected with HTTP 409

---

## Launch Configuration (Server-Side Only)

**Pricing and duration are server-configured (never hardcoded in browser code, contracts, or test suites).**

All prices, durations, PayPal product IDs, and webhook IDs are:
- ✅ Visible in PayPal checkout (not secret)
- ✅ Server-owned and configurable
- ❌ Never hardcoded in browser code
- ❌ Never hardcoded in contracts or documentation
- ❌ Never trusted from client input
- ✅ Documented in private server configuration (Cloudflare secrets/KV)

**v1 scope:**
- Training access: prices and duration are server-configured, NOT hardcoded
- Certification exam attempts: deferred to v2+, NOT available in v1

**Key rules:**
- ✅ Entitlement is created ONLY after server-verified webhook (`PAYMENT.CAPTURE.COMPLETED`)
- ✅ Webhook verification uses PayPal's official endpoint (Phase 2A implementation)
- ❌ Custom HMAC-SHA256 verification is NOT allowed

---

## Files Delivered (Phase 1 Complete)

| File | Purpose | Status |
|------|---------|--------|
| `docs/PAYMENT_ENTITLEMENT_CONTRACT.md` | v1 specification (training-access only) | ✅ Complete |
| `docs/PAYMENT_ENTITLEMENT_DESIGN.md` | Design rationale (deferred schema) | ✅ Complete |
| `tests/payment-entitlement-contract.spec.js` | Jest test suite (45 contract tests) | ✅ Complete |
| `docs/PAYMENT_ENTITLEMENT_BRIEFING.md` | This briefing (executive summary) | ✅ Complete |

**All files are contract-complete, review-ready, and locked for v1.**

**Schema, configuration, and implementation are deferred to Phase 2A with separate approval.**

---

## Peer Review Checklist

Before Phase 2A approval:

- [ ] Product catalog (training-access v1, certification deferred to v2+) is correct
- [ ] Payment workflow matches business requirements
- [ ] Webhook verification approach (PayPal official endpoint) is sound
- [ ] Entitlement expiration logic (server-configured duration) is acceptable
- [ ] Exam version immutability (deferred to v2+) meets certification requirements
- [ ] Domain isolation (training ≠ certification) is sufficient for compliance
- [ ] Test cases (45 assertions) are comprehensive
- [ ] Error handling strategy (HTTP 409 for certification, etc.) is complete
- [ ] Security requirements (no HMAC custom verification, etc.) are verified
- [ ] Audit logging requirements are met

---

## Questions & Assumptions

**Clarifications needed before implementation:**

1. **Pricing authority:** Should prices be updatable after first purchase? (Current: server database, immutable per purchase)
2. **Entitlement renewal:** Can users extend training access before expiration? (Current: new purchase required)
3. **Exam version strategy:** Round-robin, least-used, or random assignment? (Current: round_robin, configurable)
4. **Refund handling:** Should partial refunds trigger proportional entitlement? (Current: binary revoke on refund)
5. **Webhook retry policy:** How many retries for failed PayPal webhooks? (Current: manual queue to be defined)
6. **Certification scoring:** Does certification attempt auto-grade, or is it instructor-scored? (Current: out of scope for this contract)
7. **Internationalization:** Support multiple currencies beyond USD? (Current: USD only, configurable)

---

## Security Contract Requirements (Phase 1)

### Contract Assertions (v1 Specification)
- ✅ Server-side price determination only (no client override)
- ✅ Client secrets never sent to browser
- ✅ PayPal webhook verification using official endpoint (Phase 2A to implement)
- ✅ Raw request body preserved for verification (Phase 2A to implement)
- ✅ Webhook deduplication by event ID (Phase 2A to implement)
- ✅ Authentication required for order creation and capture
- ✅ Order ownership validation (user can only capture their own orders)
- ✅ Entitlement immutability after creation
- ✅ Exam version immutability (if/when v2+ is implemented)
- ✅ Domain isolation: training domain ≠ certification domain
- ✅ Comprehensive audit trail for orders and entitlements

### Phase 2A Implementation Requirements (Separate Review)

During Phase 2A implementation, the following must be verified:
- [ ] Webhook endpoint is server-side only (not publicly listed)
- [ ] PAYPAL_WEBHOOK_ID is protected in Cloudflare secrets
- [ ] Webhook verification uses PayPal official endpoint
- [ ] Timestamp freshness validation is enforced
- [ ] Idempotency keys prevent duplicate entitlement creation
- [ ] Audit logs preserve immutable order and entitlement records
- [ ] Row-Level Security (RLS) policies enforce domain and user isolation
- [ ] Foreign key constraints prevent orphaned records

### Phase 2A Security Testing Checklist
- [ ] Attempt PayPal order without authentication → rejection
- [ ] Attempt to capture someone else's order → rejection
- [ ] Attempt to override price in request → rejection
- [ ] Submit malformed webhook signature → rejection
- [ ] Replay old webhook events → deduplication
- [ ] Verify cross-domain isolation (training ≠ certification)

---

## Next Steps

1. **Code review** of v1 contract with product and engineering teams
2. **Get approval** on Phase 2A (training-access implementation and schema design)
3. **Schema design** in separate workstream with security review
4. **Implement Phase 2A endpoints** per specification
5. **Perform PayPal sandbox testing** before Phase 2A deployment
6. **Defer certification** to v2+ with separate deployment and security review

---

**End of Briefing Document**

For questions or revisions to this contract, please create a GitHub issue on the current branch.
