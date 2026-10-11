# Accessibility

Accessibility is a required design and implementation constraint across AutoLearnPro's public, learner, exam, instructor, institutional, reference, and administration experiences.

## Minimum target

AutoLearnPro targets **WCAG 2.2 AA**.

This is a design and implementation target, not a blanket conformance certification. Formal conformance claims require appropriate testing and evidence for the deployed surface.

The Phase 8A light-theme token contrast evidence is recorded in `docs/phase-8a-token-contrast-report.md` and is reproducible with:

`node scripts/phase-8a-contrast-check.js`

## Core requirements

- Full keyboard access for interactive elements and workflows.
- Visible, persistent-enough focus indication that is distinguishable from surrounding UI.
- Semantic heading structure and landmark use.
- Programmatically associated labels, names, descriptions, and error messages for controls.
- WCAG-compliant text and meaningful non-text contrast.
- Status and meaning communicated with text and/or icons, never color alone.
- Screen-reader-friendly alerts, validation feedback, and dynamic state changes.
- Reduced-motion support where motion is non-essential.
- Responsive layouts that remain usable at zoom and on smaller screens.
- Touch targets sized and spaced for practical tablet/mobile use.
- Technical diagrams and diagnostic evidence presented so essential meaning is not lost through color, scale, or viewport changes.

## Phase 8A contrast rules

### Normal text

Normal-size text must meet **4.5:1** contrast.

Use the canonical text-safe tokens where required:

- `--tm-primary-2-text` for normal-size blue text;
- `--tm-teal-text` for teal text and meaningful teal UI.

Do not use raw brand blue or raw brand teal for normal-size text merely because they are brand colors.

### Large text and meaningful non-text UI

Qualifying large/bold text and meaningful non-text UI must meet the applicable **3:1** contrast requirement.

The raw brand blue `--tm-primary-2` can be used where its measured context meets that requirement. Raw brand teal `--tm-teal` must not be used for meaningful UI where its measured contrast falls below 3:1; use `--tm-teal-text` instead.

### Status colors

- Success, warning, danger, and verified states require a textual or iconographic cue.
- `--tm-success` is the success/completed semantic color.
- Teal is not interchangeable with success.
- Do not encode pass/fail, safety, verification, approval, or completion solely through color.

### Disabled states

Disabled labels must remain readable. The Phase 8A token evidence records `--tm-muted` on canonical surfaces above 4.5:1.

A disabled control must also remain understandable through state, semantics, and interaction behavior; lower visual emphasis must not erase its identity.

### Focus states

Visible focus is mandatory.

The existing amber focus treatment is retained temporarily because it is coupled to legacy component dependencies. Its measured contrast is below the desired 3:1 non-text target on current light surfaces, so it is a documented remediation item rather than an approved end state.

This legacy-theme migration introduces and validates dedicated `--tm-focus-ring` and `--tm-focus-ring-inverse` treatments for the migrated surfaces. Remaining amber focus dependencies must be retired only when their owning components migrate.

### Borders and control boundaries

`--tm-border` is acceptable for decorative dividers, but borders that are necessary to identify an input, button, or other operable control must satisfy the applicable non-text contrast requirement in context.

## Dark-theme boundary

The `[data-theme="dark"]` token block is an implementation starting point only. No current page opts into it, and the complete dark state matrix has not yet been validated to WCAG 2.2 AA.

Do not ship a dark-themed production surface until text, interactive, focus, disabled, warning, error, success, and other meaningful states are validated in context.

## Responsive and zoom behavior

Responsive work must preserve task completion, not merely fit the viewport.

- Keep core navigation and actions reachable at common mobile/tablet sizes.
- Reflow rather than truncate essential diagnostic evidence.
- Avoid horizontal scrolling for ordinary reading content where practical.
- Complex tables and diagrams may use purpose-built responsive patterns, drawers, or controlled overflow.
- Preserve the learner's current diagnostic state when layouts reflow.
- Support browser zoom without obscuring essential controls or content.

## Dashboard rule

A dashboard or workflow is not complete until its primary task can be performed without a mouse and its status, validation, and error states remain understandable without relying on color alone.

## Validation evidence

Accessibility changes should leave durable evidence appropriate to their scope. Depending on the change, this may include:

- deterministic contrast reports;
- keyboard/focus test results;
- automated accessibility checks;
- responsive/zoom validation;
- screen-reader/manual review notes;
- documented exceptions with an owner and remediation workstream.

Phase 8A known token-level exceptions are tracked in `docs/phase-8a-token-contrast-report.md`; they must not be converted into permanent waivers by downstream implementation.
