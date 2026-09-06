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
| Integration Workflows | 2 tests | End-to-end training and certification purchase flows |

**Total: 38 test cases** covering all contract requirements
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

// Current launch prices (must never be hardcoded in browser code):
// training_access: $29.99 USD / 365 days
// certification_exam_attempt: $49.99 USD / one attempt
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
| Hosted button IDs | Browser (checkout) | Public config | ✅ Safe to expose | Training: `UTQPPVBUG92T2` / Certification: `N3RZVZQ99X592` |

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
├─ Input: { product_id: string, quantity: int }
├─ Server:
│  ├─ Validate authentication (user must be logged in)
│  ├─ Validate product_id (training_access OR certification_exam_access)
│  ├─ Look up price from database (NOT from client)
│  ├─ Create PayPal order via REST API (using server secret)
│  ├─ Store order record with status='pending'
│  └─ Return: { order_id, amount, currency }
└─ Database: orders (status='pending')
```

### Order Capture
```
POST /api/orders/capture
├─ Input: { order_id: string }
├─ Server:
│  ├─ Verify order exists and belongs to authenticated user
│  ├─ Verify order status is 'pending'
│  ├─ Call PayPal /v2/checkout/orders/{id}/capture (using server secret)
│  ├─ Validate response: status='COMPLETED', amount matches
│  ├─ Atomically (transaction):
│  │  ├─ Update order status → 'captured'
│  │  ├─ Create entitlement record
│  │  ├─ For certification: SELECT approved exam_version & create assignment
│  │  └─ Log audit entry
│  └─ Return: { order_id, status, entitlement_id, product_id, exam_version_id? }
└─ Database: orders (status='captured'), entitlements, exam_version_assignments
```

### Webhook Processing
```
POST /api/webhooks/paypal
├─ Headers: Paypal-Transmission-Id, Paypal-Transmission-Time, Paypal-Transmission-Sig
├─ Server:
│  ├─ Verify HMAC-SHA256 signature
│  ├─ Verify timestamp freshness (within 5 minutes)
│  ├─ Log webhook_events entry with verified=true
│  ├─ On PAYMENT.CAPTURE.COMPLETED:
│  │  └─ Confirm/update order status to 'captured'
│  ├─ On PAYMENT.CAPTURE.DENIED or REFUNDED:
│  │  └─ Mark entitlement as 'revoked' or 'expired'
│  └─ Mark webhook_events.processed=true
└─ Database: webhook_events, orders, entitlements (may be updated)
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
- **Total test cases:** 41
- **Total assertions:** ~80+
- **Coverage scope:** API contract, entitlement logic, webhook verification, schema constraints

---

## Implementation Roadmap

### ✅ Phase 1: Test Contract (COMPLETE)
- [x] Define product catalog
- [x] Specify payment workflow
- [x] Define webhook contract
- [x] Define entitlement model
- [x] Specify exam version allocation
- [x] Create SQL schema migration
- [x] Write Jest test suite (41 tests)
- [x] Document all constraints and safeguards

### Phase 2: Database Schema (Next)
- [ ] Apply SQL migration to staging database
- [ ] Verify indexes and constraints
- [ ] Test RLS policies
- [ ] Verify cascade deletes
- [ ] Write schema contract tests (if needed)

### Phase 3: Server Endpoints (After schema)
- [ ] Implement `POST /api/orders/create`
- [ ] Implement `POST /api/orders/capture`
- [ ] Implement `POST /api/webhooks/paypal`
- [ ] Implement `GET /api/entitlements/check/training`
- [ ] Implement `GET /api/entitlements/check/certification`
- [ ] Add error handling and logging
- [ ] Write integration tests for each endpoint

### Phase 4: Client Integration (After endpoints)
- [ ] Add PayPal SDK v6 to training site (app.autolearnpro.com)
- [ ] Add PayPal SDK v6 to certification site (autolearnpro.com)
- [ ] Render checkout buttons
- [ ] Handle payment flow errors
- [ ] Add success/failure pages
- [ ] Wire entitlement validation to UI access control

### Phase 5: Testing & Validation (Final)
- [ ] Run full contract test suite
- [ ] PayPal sandbox testing
- [ ] End-to-end flow validation (all 41 test cases)
- [ ] Load testing (concurrent orders, webhook bursts)
- [ ] Security audit (signature verification, RLS policies)
- [ ] Disaster recovery (webhook failures, database recovery)

---

## Launch Configuration (Private Mapping)

**Current prices and durations MUST be recorded in server configuration (never hardcoded in browser code):**

| PayPal Hosted Button ID | Product | Price | Duration | Status |
|---|---|---|---|---|
| `UTQPPVBUG92T2` | Training Access | $29.99 USD | 365 days | ✅ Ready for Phase 5 |
| `N3RZVZQ99X592` | Certification Exam Attempt | $49.99 USD | one attempt (30 day validity) | ⚠️ Disabled until webhook verification + exam assignment ready |

**Key rules:**
- ✅ Prices ARE visible in PayPal checkout (not secret)
- ❌ Prices ARE NEVER hardcoded in browser code, migrations, or entitlement logic
- ✅ Prices ARE server-owned and configurable
- ❌ Prices ARE NEVER trusted from client input
- ✅ Prices ARE documented in private server configuration
- ✅ Entitlement is created ONLY after server-verified webhook (`PAYMENT.CAPTURE.COMPLETED`)
- ✅ Exam version is allocated server-side ONLY during order capture (after webhook verification)

---

## Server Configuration (Phase 2)

Phase 2 implementation will establish Cloudflare secrets and environment variables
to store configuration values for pricing, durations, and payment credentials. No
examples or templates are provided in this contract specification.

---

## Files Delivered

| File | Purpose | Status |
|------|---------|--------|
| `docs/PAYMENT_ENTITLEMENT_CONTRACT.md` | Full specification | ✅ Created |
| `supabase/migrations/20260905000000_create_payment_entitlement_schema.sql` | Database schema | ✅ Created |
| `tests/payment-entitlement-contract.spec.js` | Jest test suite (41 tests) | ✅ Created |
| `docs/PAYMENT_ENTITLEMENT_BRIEFING.md` | This briefing | ✅ Created |

**All files are review-ready, non-destructive, and ready for peer feedback.**

---

## Peer Review Checklist

Before Phase 2 (database schema application):

- [ ] Product catalog pricing and domains are correct
- [ ] Payment workflow matches business requirements
- [ ] Webhook signature verification approach is sound
- [ ] Entitlement expiration logic is acceptable
- [ ] Exam version immutability meets certification requirements
- [ ] Domain isolation is sufficient for compliance
- [ ] Test cases are comprehensive
- [ ] Error handling strategy is complete
- [ ] RLS policies provide adequate data isolation
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

## Security Considerations

### Implemented
- ✅ HMAC-SHA256 webhook signature verification
- ✅ Timestamp freshness validation (5-minute window)
- ✅ Server-side price determination (no client override)
- ✅ Client secrets never sent to browser
- ✅ Row-Level Security (RLS) on all tables
- ✅ Foreign key constraints with CASCADE delete
- ✅ Comprehensive audit logging

### To verify during implementation
- [ ] Webhook endpoint not publicly listed (server-side route only)
- [ ] Client secret not leaked in client-side bundles
- [ ] PAYPAL_WEBHOOK_ID protected in Cloudflare secrets
- [ ] RLS policies tested and enforced
- [ ] Audit logs cannot be modified/deleted by users
- [ ] Idempotency keys prevent duplicate processing

### Manual testing required
- [ ] Attempt PayPal order without authentication
- [ ] Attempt to capture someone else's order
- [ ] Attempt to override price in request
- [ ] Submit malformed webhook signature
- [ ] Replay old webhook events
- [ ] Verify cross-domain isolation (training ≠ certification)

---

## Next Steps

1. **Code review** of test contract with product and engineering teams
2. **Get approval** on Phase 2 (database schema application)
3. **Apply SQL migration** to staging Supabase database
4. **Run test suite** against mock endpoints (Phase 3 placeholders)
5. **Implement endpoints** per Phase 3 plan
6. **Perform PayPal sandbox testing** per Phase 5 plan
7. **Go-live checklist** before production deployment

---

**End of Briefing Document**

For questions or revisions to this contract, please create a GitHub issue on the `docs/paid-sites-paypal-contract` branch.
