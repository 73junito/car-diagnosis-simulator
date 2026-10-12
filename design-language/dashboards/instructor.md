# Instructor Dashboard Specification

## Purpose

The instructor workspace is the authenticated operational surface for verified instructors. It brings together classroom management, live telemetry, session history, analytics, research discovery, governed authoring, and institution access without duplicating authorization logic in the browser.

## Authorization

- Entry requires a server-verified trusted instructor role and approved instructor affiliation unless the caller is a platform administrator acting through an explicitly authorized admin path.
- Browser storage, URL parameters, institution identifiers, email-domain matches, or hidden form fields never grant instructor authority.
- Class-scoped reads require server-side ownership or another explicitly governed tenant/class relationship.
- Institution access requires an active institution membership; instructor verification alone does not grant institution-admin authority.
- Authoring access remains governed separately from assessment eligibility and publication.

## Information architecture

1. Instructor Workspace home
   - verification/authorization state
   - Classes & Assignments
   - Live Session
   - Session History
   - Analytics
   - Research Discovery
   - Authoring Studio
   - Institution Portal

2. Classes & Assignments
   - owned class list
   - class creation
   - class code
   - roster
   - assignments
   - only server-authorized owned classes
   - no browser-trusted ownership

3. Live Session
   - owned-class selector
   - connection state
   - active-session count
   - governed event feed
   - reconnect behavior
   - class-scoped telemetry only

4. Session History
   - owned-class selector
   - session filter
   - bounded result limit
   - JSON/CSV export
   - explicit loading/error/empty states

5. Analytics
   - owned-class selector
   - student/session aggregate metrics
   - CSV/xAPI export
   - no cross-class population leakage
   - no answer-key or grading-secret exposure

6. Research Discovery
   - authenticated governed research search
   - curriculum evidence gaps
   - source/right review
   - enhancement drafting
   - approved-source boundaries remain authoritative

7. Authoring Studio
   - server-backed private drafts
   - owner-scoped editing
   - evidence linkage
   - review request
   - publication request
   - publication remains separate from assessment eligibility

8. Institution Portal
   - active membership required
   - institution tenant, programs, cohorts, and authorized classes
   - admin controls appear only for institution-admin/owner roles

## Interaction rules

- Every asynchronous module exposes loading, success, empty, authorization failure, and dependency failure states.
- Data unavailable is shown as unavailable; sample or placeholder privileged data is never substituted.
- Destructive or high-impact actions require explicit confirmation.
- Assignment, membership, publication, and review actions preserve their existing server governance.
- Exports are generated only from data already authorized for the current instructor/class scope.
- UI controls may hide unavailable actions for usability, but server authorization remains authoritative.

## Classroom states

Classes & Assignments must support:
- no classes yet
- one or more owned classes
- class creation in progress
- roster empty
- assignment list empty
- server denial for non-owned/cross-tenant class access
- stale or invalid class code
- API unavailable

The page must never infer ownership from browser state.

## Live telemetry states

Live Session must support:
- disconnected
- connecting
- connected
- reconnecting
- no active events
- events available
- authorization denied
- class not owned
- stream unavailable

Clear/reconnect actions affect only the local session UI and do not alter authoritative telemetry history.

## Session history states

Session History must support:
- loading
- no events
- filtered empty
- export unavailable
- authorization denied
- class not owned
- partial dependency failure

Exports must preserve the same class/user authorization scope as the visible results.

## Analytics states

Analytics must support:
- class selection required
- loading
- no enrolled learners
- no attempt/activity data
- aggregate metrics available
- export available/unavailable
- authorization denied
- dependency failure

Operational analytics must not be described as a transcript, credential, academic-credit record, or institutional grade unless separately authorized.

## Research and evidence governance

Research Discovery may:
- search approved external research providers through server routes
- identify evidence gaps
- create governed evidence records
- review source rights
- prepare curriculum enhancements

It may not:
- turn a source into assessment eligibility
- treat link-only material as stored/RAG content
- bypass source-rights review
- expose service credentials

## Authoring governance

The Authoring Studio may:
- create and edit private drafts
- autosave governed server-backed drafts
- link approved evidence
- request review
- request publication after required review/evidence conditions

It may not:
- self-approve review
- self-publish without the required human publication gate
- grant learner delivery
- grant scoring authority
- grant assessment eligibility

## Audit visibility

Instructor-facing modules should show decision/status metadata where useful, but audit evidence remains immutable and is not editable from the instructor UI.

Examples:
- review requested/completed timestamps
- publication status
- verification status
- institution membership status

## Responsive behavior

- Workspace cards collapse to a single column on narrow screens.
- Class selectors and action groups wrap without hiding labels.
- Tables remain horizontally scrollable where necessary rather than truncating critical values.
- Live status and error messages remain visible without relying on color alone.
- Touch targets remain fully labeled.

## Accessibility

- Each page has one clear primary heading.
- Form controls have explicit labels.
- Loading and save/connection states use live regions where appropriate.
- Error messages identify the affected operation.
- Buttons use action text rather than icon-only meaning for consequential actions.
- Table headers remain associated with their columns.
- Keyboard access must be possible for all core instructor workflows.

## Security boundaries

The instructor workspace does not:
- authorize from `localStorage` or other browser role claims
- read cross-user data outside authorized class/institution scope
- expose service-role credentials
- expose answer keys or `is_correct` audit fields
- create institution-admin authority from a school code or domain
- convert publication, curriculum inclusion, or source approval into assessment eligibility
- bypass human review/approval transitions

## Operational failure policy

When a required backend dependency is unavailable:
- fail closed for privileged actions
- retain truthful status text
- disable only the affected controls
- do not display stale privileged data as current
- do not fall back to legacy unscoped APIs

## Release acceptance

The instructor dashboard is production-ready when:
- home navigation exposes only implemented authoritative modules
- every browser-called API route exists on the production Worker runtime
- server authorization protects instructor/class/tenant scope
- live telemetry and history use class-scoped authorization
- analytics exports match visible authorized data
- research and authoring preserve evidence/rights/governance boundaries
- destructive/high-impact actions require confirmation where applicable
- loading, empty, error, and authorization states are explicit
- responsive and keyboard-access behavior remains usable
- no instructor workflow can indirectly grant assessment eligibility or release authority
