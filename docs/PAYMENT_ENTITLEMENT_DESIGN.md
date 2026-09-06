# Payment & Entitlement Schema Design (Deferred)

**Status:** ⚠️ **NOT YET IMPLEMENTED — Requires Business Decision**
**Branch:** Deferred to next iteration
**Purpose:** This document outlines design considerations for a future database schema migration. Nothing here is deployable yet.

---

## Required Business Decision

Before any database schema can be finalized, TorqueMind must choose between two entitlement models:

### Option A: Fixed-Duration Training Access (Recommended for v1)
**Model:** User purchases one-time access to training for a defined period.

**Characteristics:**
- Single purchase grants access for N days (server-configured)
- Access expires after N days regardless of usage
- User can purchase again if access has expired
- No renewal, no cancellation complexity
- Simpler payment/entitlement flow

**Data model:** A later migration will define the entitlement schema with fields for user,
product, status, creation time, expiration time, and revocation tracking.

**Entitlement lifecycle:**
```
Order Created → PayPal Approved → Webhook Captured → Entitlement Active
                                                         ↓
                                              (365 days pass)
                                                         ↓
                                            Entitlement Expired
```

**Recommended for v1 because:**
- ✅ Simplest implementation
- ✅ No subscription lifecycle management (renewal, cancellation, failures)
- ✅ Clear user mental model (buy once, use for X days)
- ✅ No ongoing payment processing needed
- ✅ Audit trail is straightforward

---

### Option B: Recurring Training Subscription
**Model:** User subscribes to recurring monthly/annual access, with automatic renewal.

**Characteristics:**
- Recurring payment (monthly, quarterly, annual)
- Access automatically renews on each payment
- User can cancel subscription anytime
- PayPal handles billing and renewal
- Must handle payment failures, cancellations, refunds

**Data model:** A later migration will define subscription and entitlement schemas with
fields for user, payment reference, status, billing cycle, and cycle-specific entitlements.

**Entitlement lifecycle:**
```
Subscription Created → First Payment Approved → First Entitlement Active
                                                       ↓
                                        (30 days pass, renewal due)
                                                       ↓
                                  Payment Captured Again → New Entitlement
                                                       ↓
                                  (Repeat or User Cancels)
```

**Requires additional webhook handling:**
- `BILLING.SUBSCRIPTION.CREATED` → Set status = 'active'
- `BILLING.SUBSCRIPTION.ACTIVATED` → Resume if paused
- `BILLING.SUBSCRIPTION.CANCELLED` → Set status = 'cancelled', revoke entitlements
- `BILLING.SUBSCRIPTION.PAYMENT_FAILED` → Mark subscription at risk, notify user
- `PAYMENT.SALE.COMPLETED` → Create new entitlement for next cycle

**NOT recommended for v1 because:**
- ❌ Much more complex payment lifecycle
- ❌ Requires handling payment failures and retries
- ❌ Subscription cancellation at any time (refund logic?)
- ❌ Renewal failures need user notification and recovery
- ❌ More webhook event types to handle
- ❌ Support burden increases significantly

---

## Decision: Which Model for v1?

### Recommendation: **Option A (Fixed-Duration)**

**Rationale:**
1. **Simpler implementation** → Faster to ship, fewer bugs
2. **Simpler operations** → No payment failure handling, no cancellation logic
3. **Clearer UX** → Users understand "buy once, use for 365 days"
4. **Easier testing** → No recurring payment cycles to simulate
5. **Easier support** → No subscription lifecycle issues
6. **Easier upgrade path** → Can add subscriptions in v2 without breaking existing code

**Future path to subscriptions:**
- v1: Fixed-duration access (payment-entitlement is stable)
- v2: Add recurring subscriptions alongside fixed-duration
- v3: Migrate users (if desired) to subscription model

---

## Deferred Data Model Requirements

No payment, entitlement, exam-assignment, or answer-key schema is introduced by
this contract.

A later implementation proposal must preserve financial and certification audit
records, avoid cascading deletion of payment or exam records, keep answer-key
data server-only, and receive separate schema and security review before any
database migration is created.

---

## References

- [PayPal Subscriptions API](https://developer.paypal.com/api/rest/reference/subscriptions/create-subscription/)
- [PayPal Webhook Events](https://developer.paypal.com/api/webhooks/v1)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL CASCADE Options](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
