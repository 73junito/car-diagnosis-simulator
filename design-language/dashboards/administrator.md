# Administrator Dashboard Specification

## Purpose

The administrator dashboard is the central least-privilege operations surface for platform-level governance. It consolidates existing governed review queues and exposes read-only operational visibility without creating new browser-trusted authority.

## Authorization

- Access requires a server-verified platform administrator role.
- Browser storage, query parameters, institution identifiers, and email domains never grant administrator access.
- Institution administrators use the institution portal and do not inherit platform-admin capabilities.
- All privileged reads and writes pass through Worker routes using the service-role boundary.

## Information architecture

1. Operations overview
   - total users
   - total institutions
   - active institution memberships
   - pending instructor reviews
   - pending student institution claims
   - pending authoring reviews
   - pending publication approvals

2. Users and trusted roles
   - email/user ID
   - effective trusted role
   - trusted-role source
   - profile role when different
   - account confirmation/sign-in timestamps
   - read-only in G10; privileged role mutation is intentionally excluded until one authoritative role-write path exists

3. Institutions
   - institution identity
   - directory active/inactive state
   - active membership count
   - owner/admin coverage
   - active verified-domain count
   - initial-owner bootstrap remains a separately confirmed action

4. Governed review queues
   - instructor affiliation review
   - student institution-claim review
   - authoring draft review
   - publication approval

5. Unified audit history
   - normalized view over existing append-only reviewer and institution-administration evidence
   - actor, action, target, tenant, timestamp, and note when available
   - no modification or deletion controls

6. Operational configuration
   - platform operational note
   - enable/disable first-owner bootstrap
   - high-risk toggle changes require explicit browser confirmation and server-side confirmation
   - every update writes append-only audit evidence

## Interaction rules

- High-risk actions require explicit confirmation.
- Rejections and negative review decisions require explanatory notes where the governed workflow requires them.
- Empty states must describe the actual absence of data.
- Error states must not substitute sample or cached privileged data.
- A failed operational-config lookup disables the corresponding controls.
- Disabling owner bootstrap prevents new first-owner invitations server-side; it does not revoke existing invitations or memberships.

## Audit visibility

The unified audit view aggregates existing governed evidence from:
- instructor verification decisions
- student institution-claim decisions
- institution membership events
- institution domain events
- institution settings events
- authoring review events
- publication events
- platform operational-setting events

Audit records are append-only and never editable in the administrator UI.

## Responsive behavior

- Summary metrics use an auto-fitting card grid.
- Toolbars wrap on narrow viewports.
- Destructive/high-risk actions remain fully labeled and do not collapse into icon-only controls.
- Mobile layouts preserve status messages and confirmation behavior.

## Security boundaries

The dashboard does not:
- grant assessment eligibility
- expose answer keys or `is_correct` fields
- expose service-role credentials
- allow institution identifiers or domains to grant access
- self-approve review actions
- mutate privileged roles from the browser
- bypass tenant authorization for institution-scoped data

## Operational states

Each module must support:
- loading
- success
- empty
- authorization failure
- dependency/configuration unavailable
- save/decision in progress

Status text uses live regions where user action or asynchronous state changes need announcement.

## Release acceptance

The administrator dashboard is production-ready when:
- all browser-called routes exist on the Worker runtime
- non-admin access is denied server-side
- user/role and institution views are truthful and bounded
- review queues continue to preserve their existing governance rules
- operational setting changes are explicitly confirmed and audited
- audit history is read-only
- no module can alter assessment eligibility or release authority indirectly
