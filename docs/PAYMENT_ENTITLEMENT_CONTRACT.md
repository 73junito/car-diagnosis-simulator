# Payment & Entitlement Contract (v1 - Fixed-Duration Model)

## Overview

This document specifies the contract for paid access to training and certification using PayPal integration. It defines:
- Product catalog (identifiers, no prices)
- Server-side payment workflow
- PayPal official webhook verification
- Entitlement allocation rules
- Exam version assignment and immutability
- Test cases and validation

**Status:** Design phase (test-first contract, no implementation yet)
**Branch:** `docs/paid-sites-paypal-contract`
**Model:** v1 Fixed-Duration (not recurring subscriptions)
**Updated:** 2026-09-05

---

## ⚠️ CRITICAL: PayPal Payment Links Are NOT Sufficient

A PayPal Payment Button/Link in the browser is **purely a user interface for checkout**. It DOES NOT grant access to training or exams.

**Access is granted ONLY after:**
1. Server receives PayPal webhook: `PAYMENT.CAPTURE.COMPLETED`
2. Server verifies webhook signature with PayPal's official verification endpoint
3. Server creates immutable entitlement record in database
4. Client checks entitlement status via authenticated API

**This is not negotiable:** No payment = no access. Webhook verification is mandatory.

**References:**
- PayPal Security Guidelines: https://docs.paypal.ai/developer/how-to/security-guidelines
- PayPal Webhooks API v1: https://developer.paypal.com/api/webhooks/v1

---

## Checkout Integration Decision

### v1: Training Access Only

v1 uses a **direct, authenticated PayPal Orders integration** for `training_access` only.

**Why not Hosted Buttons or Payment Links?**
Hosted buttons are pre-configured by PayPal and bypass server-side order creation. They do not support the required authenticated user-to-order binding, which is critical for reliable entitlement creation and webhook deduplication.

**v1 Checkout Flow (training_access):**
1. Authenticated user on `app.autolearnpro.com` initiates training access purchase
2. Client calls `POST /api/orders/create` with `product_id: "training_access"`
3. Server creates order via PayPal Orders API (REST v2)
4. Server passes `paypal_order_id` to browser
5. Browser initializes PayPal Checkout SDK with `paypal_order_id` (JavaScript SDK v6)
6. User approves payment in PayPal UI
7. Server receives PayPal webhook: `PAYMENT.CAPTURE.COMPLETED`
8. Server verifies webhook with PayPal official endpoint, creates entitlement atomically
9. Training features become available

### v1: Certification Exam Attempts Deferred

Certification exam attempt purchases are **NOT supported in v1**. Any request for `certification_exam_attempt` is rejected with a "deferred to v2" message.

When v2 deploys certification infrastructure separately on `autolearnpro.com`, certification purchases will use the same direct Orders API flow, with the additional requirement of immutable exam-version assignment during webhook processing.

**Non-Production References:**
Earlier hosting experiments have been deferred. They are NOT part of v1 or v2 entitlement workflows.

**Client Approval Callback Rule:**
A client-side approval callback (e.g., `onApprove`) NEVER grants access. Access activates only after server verification and webhook processing.

---

## 1. Product Catalog (Identifiers Only, Server Configuration)

**⚠️ Important:** Prices, durations, PayPal product IDs, and webhook IDs are server-side configuration. They are NOT part of this contract and are NOT hardcoded.

### 1.1 Training Access

**Product ID:** `training_access`
**Domain:** `app.autolearnpro.com`
**Model:** Fixed-duration (one purchase = fixed expiration)
**Launch Configuration:**
- Price: Server-configured (visible in PayPal checkout, not hardcoded)
- Duration: Server-configured days (not hardcoded)
- PayPal Product ID: Server-configured (not in contract)

**Features:**
- Practice scenarios with feedback
- Learning analytics and progress tracking
- Tutor explanations
- Adaptive learning engine

**Payment Configuration:** All pricing and duration settings are server-configured via environment variables and database configuration, not client-controlled or hardcoded.

### 1.2 Certification Exam Attempt (Planned for v2+)

**Product ID:** `certification_exam_attempt` (NOT available in v1)

**Status:** Deferred to v2. Certification exam attempts are planned for deployment on a separately configured and reviewed certification site (`autolearnpro.com`). v1 does NOT support certification purchases. Any request for this product in v1 is rejected with an explicit "deferred to v2" message.

**Planned Model:** Fixed-duration + immutable version assignment (v2 when deployed)

**Planned Launch Configuration (v2+):**
- Domain: `autolearnpro.com` (after separate apex-domain deployment)
- Price: Server-configured (visible in PayPal checkout, not hardcoded)
- Validity Period: Server-configured days (not hardcoded)
- PayPal Product ID: Server-configured (not in contract)

**Planned Behavior (v2+):**
- One purchase = one exam attempt
- Server atomically assigns immutable exam version
- Expires at expiration_date OR after one attempt (whichever is first)
- User cannot receive same exam version twice

**Planned Features (v2+):**
- One scored exam attempt
- Immutable, server-assigned version
- NO tutoring, explanations, or feedback

**v1 Requirement:** All requests for `certification_exam_attempt` MUST be rejected with HTTP 409 (Conflict):
```json
{
  "status": 409,
  "error": "product_not_available",
  "code": "CERTIFICATION_DEFERRED",
  "message": "Certification exam attempts are not available in v1."
}
```

---

## 2. Server-Side Payment Workflow

### 2.1 Environment Configuration (Server-Side Only)

All configuration is server-owned. Client never sees or supplies these values.

```javascript
// Server-side configuration (Cloudflare secrets/KV, NOT in code)
// v1 scope: training_access only
const config = {
  // Public client IDs (safe for browser)
  PAYPAL_TRAINING_CLIENT_ID: "...",

  // Secrets (server-side only)
  PAYPAL_CLIENT_SECRET: "...",
  PAYPAL_WEBHOOK_ID: "...",

  // Product configuration (server-side only)
  products: {
    training_access: {
      paypalProductId: "...",
      durationDays: parseInt(process.env.TRAINING_DURATION_DAYS), // Server-configured, no default
      priceCents: parseInt(process.env.TRAINING_PRICE_CENTS) // Only server knows
    }
    // certification_exam_attempt: DEFERRED TO v2+
  },

  // PayPal endpoints
  PAYPAL_ENVIRONMENT: 'sandbox' | 'live',
  PAYPAL_API_BASE: 'https://api-m.paypal.com' (live)
};
```

### 2.2 Order Creation (Server-Only)

**Endpoint:** `POST /api/orders/create`
**Authenticated:** Yes (user must be logged in)

**Client request:**
```json
{
  "product_id": "training_access"
}
```

**Server processing:**
1. Validate user authentication
2. Validate product_id is exactly `"training_access"` (only v1 product)
3. If product_id is `"certification_exam_attempt"`, reject with HTTP 409 (Conflict) and response: `{ "status": 409, "error": "product_not_available", "code": "CERTIFICATION_DEFERRED", "message": "Certification exam attempts are not available in v1." }`
4. Reject any request with amount, price, currency, or duration fields
5. Look up product configuration from server config
6. Calculate price from server config (NOT client-supplied)
7. Create PayPal order via PayPal Orders API (REST v2) with server-side secret
8. Create local order record with status='pending'
9. Return order_id and paypal_order_id to client

**Server response:**
```json
{
  "order_id": "22222222-2222-2222-2222-222222222222",
  "paypal_order_id": "paypal_order_abc123",
  "product_id": "training_access",
  "status": "pending",
  "created_at": "2026-09-05T12:00:00Z"
}
```

**Server state:** A pending order record is created and persisted to track the PayPal order ID, product, and status. Schema and storage mechanism are implementation details deferred to Phase 2.

### 2.3 PayPal Checkout (Client-Side UI)

**Client flow:**
1. Receive order_id and paypal_order_id from server
2. Initialize PayPal SDK with paypal_order_id
3. User approves payment in PayPal UI
4. User is redirected back to app
5. Client sends order_id to server for capture

**Client request:**
```json
{
  "order_id": "22222222-2222-2222-2222-222222222222"
}
```

### 2.4 Order Capture (Server-Only)

**Endpoint:** `POST /api/orders/capture`
**Authenticated:** Yes

**Server processing:**
1. Validate order_id exists and belongs to authenticated user
2. Validate order status is 'pending'
3. Verify order with PayPal API: `GET /v2/checkout/orders/{paypal_order_id}`
4. Validate PayPal response: status='APPROVED' or payment captured
5. Atomically:
   - Update order status to 'captured'
   - Create entitlement record with fixed expiration_date
   - Create audit log entry
6. Return entitlement confirmation

**Server response (v1: training_access only):**
```json
{
  "order_id": "22222222-2222-2222-2222-222222222222",
  "status": "captured",
  "entitlement_id": "33333333-3333-3333-3333-333333333333",
  "product_id": "training_access",
  "expires_at": "2027-09-05T12:00:00Z"
}
```

## Atomic Capture Requirement

After a server verifies that PayPal captured the order, it must atomically:

1. Record the verified capture against the matching local order.
2. Create or return the existing entitlement when the event is retried.
3. Set the fixed training expiration for `training_access`.
4. Write an audit record.

**v1 scope:** Training access only. Certification exam version allocation is deferred to v2+.

The implementation proposal must define transaction boundaries, idempotency,
authorization, retention, and concurrency handling in a separately reviewed
schema/API change. This contract introduces no SQL or database changes.

---

## 3. Webhook Verification (MANDATORY)

### 3.1 Webhook Subscription

Server subscribes to PayPal webhook events:
- `PAYMENT.CAPTURE.COMPLETED` (payment successfully captured)
- (Optional) `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`

**Webhook endpoint:** Server-side only, not publicly listed
**Webhook ID:** Server-configured secret (stored in Cloudflare secrets)

### 3.2 Verification Flow (Official PayPal Method)

**DO NOT use custom HMAC-SHA256.** Use PayPal's official verification endpoint.

**Step 1: Receive webhook (Direct PayPal Orders Payment Completes)**
```
AutoLearn Pro Server creates PayPal order via Orders API
→ Browser initializes PayPal Checkout (SDK v6) with orderId
→ User completes payment on PayPal
→ PayPal captures payment and sends webhook to server with headers:
  - Paypal-Transmission-Id
  - Paypal-Transmission-Time
  - Paypal-Transmission-Sig
  - Paypal-Cert-Url
  - Paypal-Auth-Algo
  - Body: raw JSON (PAYMENT.CAPTURE.COMPLETED)

IMPORTANT: Webhook verification MUST succeed before creating entitlement or allocating exam version
```

**Step 2: Extract raw body**
```javascript
const rawRequestBody = req.rawBody; // Must be the exact bytes received, not re-stringified
```

**Step 3: Call PayPal verification endpoint**
```javascript
const verificationPayload = {
  transmission_id: req.headers['Paypal-Transmission-Id'],
  transmission_time: req.headers['Paypal-Transmission-Time'],
  cert_url: req.headers['Paypal-Cert-Url'],
  auth_algo: req.headers['Paypal-Auth-Algo'],
  transmission_sig: req.headers['Paypal-Transmission-Sig'],
  webhook_id: process.env.PAYPAL_WEBHOOK_ID, // Server-configured
  event_body: rawRequestBody.toString('utf-8')
};

const response = await fetch('https://api.paypal.com/v1/notifications/verify-webhook-signature', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(verificationPayload)
});

const result = await response.json();
// { "verification_status": "SUCCESS" or "FAILURE" }
```

**Step 4: Process only if verification succeeds**
```javascript
if (result.verification_status !== 'SUCCESS') {
  // Log error; respond 401/403 to PayPal (webhook will retry)
  return response.status(403).send('Verification failed');
}

// Safe to process webhook
```

### 3.3 Webhook Processing

**On verified `PAYMENT.CAPTURE.COMPLETED`:**

1. Extract paypal_event_id from webhook
2. Check if already processed (deduplication)
3. Look up local order by paypal_order_id
4. Trigger order capture (same atomic operation as manual capture)
5. Log audit record
6. Respond 200 OK to PayPal

**Idempotency:** Webhook processing must track event IDs to detect and handle duplicate deliveries.
If a webhook with the same `paypal_event_id` has already been processed successfully, the server must
respond 200 OK without reprocessing. If not yet processed, the server must process it atomically and
record the event ID to prevent replay.

---

## 4. Domain Deployment Status

### Current Production

**`autolearnpro.com`** is the public marketing and product-information site. It provides information about AutoLearnPro, platform highlights, and learning outcomes. It currently includes training-oriented content (AI tutor, learning scenarios, student success stories). No certification payment, exam checkout, or exam-version allocation is enabled on this domain.

**`app.autolearnpro.com`** is the training application. It provides student, instructor, and author workspaces for diagnostic scenario practice, feedback, analytics, and learning management.

### Target Certification Architecture

**`autolearnpro.com` (planned)** will become the certification-only examination entry point after a separately reviewed site configuration and deployment. The apex domain will host a certification-specific landing page, payment entry point, and exam attempt flow. This separation requires:

1. Separate site infrastructure and routing
2. Removal of training-oriented content (tutor info, practice scenarios, learning features)
3. Configuration of certification-only checkout flow
4. Deployment and testing of domain routing and RLS policies
5. Separate security review and approval before any certification payment is activated

Until that deployment is complete, `autolearnpro.com` remains a marketing site only. No `certification_exam_attempt` product is available for purchase on the apex domain.

### v1 Launch Scope

v1 activates `training_access` purchases on `app.autolearnpro.com` only. Certification payment integration is deferred to v2 and requires the separate apex-domain deployment described above.

---

## 5. Entitlement Validation Contract

### 4.1 Entitlement Check Endpoint (v1: training_access only)

**Endpoint:** `GET /api/entitlements/check/training_access`
**Authenticated:** Yes

**Server response:**
```json
{
  "has_access": true | false,
  "product_id": "training_access",
  "status": "active" | "expired" | "revoked" | null,
  "expires_at": "2027-09-05T12:00:00Z"
}
```

**Rules:**
- `has_access = true` ONLY if `status='active'` AND `expires_at` is in the future
- `has_access = false` if `status='expired'` (expires_at in past)
- `has_access = false` if `status='revoked'`
- `has_access = false` if no entitlement exists

**v2+ note:** Certification entitlement check is deferred and will include `exam_version_id` when implemented.

### 4.2 Access Control

**Training domain (app.autolearnpro.com):**
- Block if no `training_access` entitlement with `has_access=true`
- Response: 403 Forbidden

**Certification domain (autolearnpro.com - planned, not active in v1):**
- When enabled after separate apex-domain deployment: block if no `certification_exam_attempt` entitlement with `has_access=true`
- Response: 403 Forbidden
- Status: Not yet active in v1; no exam checkout or version allocation enabled

---

## 6. Exam Version Assignment (Planned for v2+)

### 6.1 Planned Assignment Rules (v2+)

**When:** During order capture for `certification_exam_attempt` product in v2 (after apex-domain deployment)

**How:** Server selects an exam version from the pool that user hasn't taken

**Constraints (v2+):**
- Each user + exam_version_id pair is unique (no re-use)
- Assignment is immutable (cannot be changed after creation)
- User always gets a new exam version with each purchase

### 6.2 Implementation Rules (v2+)

**Server requirements during order capture (planned for v2):**
1. Select an exam version from the available pool that this user has not yet been assigned
2. Verify that the user + exam_version_id combination does not already exist
3. If it exists (retry scenario), return the same entitlement without re-assigning
4. If it doesn't exist, create a new entitlement with the selected version
5. Record the assignment as immutable (no updates to exam_version_id after creation)

Database schema, transaction semantics, and version-pool management are deferred to Phase 2 implementation proposal.

**v1 Requirement:** v1 does not process `certification_exam_attempt` orders. No exam version assignment occurs in v1. Any request for certification products is rejected before reaching this section.

```

---

## 7. Domain Isolation

### 7.1 Training Domain (app.autolearnpro.com)

**Access requirement:** `training_access` entitlement with `has_access=true`

**Features available:**
- Practice scenarios with feedback
- Tutor explanations and hints
- Answer keys (NOT linked to payment schema, separate infrastructure)
- Learning analytics
- Adaptive recommendations

### 7.2 Certification Domain (autolearnpro.com - Planned, v2+)

**Planned access requirement (when deployed):** `certification_exam_attempt` entitlement with `has_access=true`

**Planned features (when deployed):**
- One scored exam attempt with assigned version
- Immutable exam version (cannot be changed)

**Features BLOCKED:**
- Tutor explanations or hints
- Answer keys or feedback
- Analytics during exam
- Scenario replay or re-grading

---

## 8. Audit Trail (Compliance Logging)

All payment and entitlement mutations must be logged for compliance and audit purposes.
Implementation details are deferred to Phase 2 schema review.

---

## 9. Test Contract Coverage

**File:** `tests/payment-entitlement-contract.spec.js`

**45 test assertions:**
- Product catalog: training_access v1 only, certification deferred to v2+
- Order creation: training_access only, certification rejected with HTTP 409
- Order capture: training_access entitlement creation with server-configured expiration
- Webhook verification: PayPal official endpoint verification, event deduplication
- Entitlement validation: access control by domain and product
- Security: no client price override, no HMAC custom verification, server-configured only
- Error handling: authentication, authorization, malformed requests
- Domain isolation: training domain ≠ certification domain

**Approach:** Contract-only assertions on security rules and prohibited behaviors (no payment processor mocking)
