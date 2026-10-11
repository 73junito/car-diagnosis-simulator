# Spacing

AutoLearnPro uses an **8px-based spacing system** to create consistent rhythm across public, learning, instructor, institutional, reference, and administrative surfaces.

The 8px system is the governing layout rule. Half-step and intermediate values exist for compact UI needs, but new arbitrary spacing values should not be introduced without a component-level reason.

## Canonical scale

| Value | Role |
| ---: | --- |
| 4px | Half-step for tight inline spacing and compact icon/text relationships |
| 8px | Base unit; compact spacing |
| 12px | 1.5-step; forms, badges, compact grouped controls |
| 16px | 2-step; standard component padding/gaps |
| 24px | 3-step; section/component separation |
| 32px | 4-step; major region separation |
| 48px | 6-step; page-level spacing |
| 64px | 8-step; large layout separation |

## Usage rules

- Start from multiples of the 8px base unit.
- Use 4px only for genuinely tight relationships such as icon/text or inline metadata.
- Use 12px where a compact control pattern needs more than 8px but 16px would materially loosen the component.
- Prefer existing scale values before creating a new value.
- Group related information more tightly than unrelated information.
- Use larger spacing to communicate hierarchy, not as decoration.
- Keep repeated components on the same internal padding/gap pattern.
- Do not compensate for misaligned typography or component sizing with one-off margins.

## Responsive behavior

Responsive layouts should preserve hierarchy and task flow rather than simply shrink desktop spacing.

- Reduce page-level whitespace before compressing control touch areas.
- Preserve sufficient separation between interactive targets.
- Allow multi-column regions to stack while keeping their logical grouping intact.
- Diagnostic evidence, actions, and current state should remain visually associated after reflow.
- Mobile and tablet layouts may use denser page margins, but component spacing should remain consistent with the scale.

## Component guidance

- **Buttons and controls:** use scale-aligned padding and gaps; do not reduce target size solely to fit content.
- **Cards and panels:** prefer 16px or 24px internal padding depending on information density.
- **Forms:** use consistent vertical spacing between label/control/help/error groups.
- **Tables:** use compact but readable row/cell spacing and preserve clear separation of actions from data.
- **Navigation:** keep predictable spacing between icon, label, group, and active-state treatments.
- **Diagnostic workflows:** visually group concern, evidence, decision, and verification content so spacing reinforces reasoning order.

## Implementation boundary

Phase 8A documentation establishes the spacing language; it does not require immediate replacement of every legacy spacing value.

The legacy-page migration and component-normalization workstreams should converge existing surfaces onto this scale without changing product behavior or functional authorization boundaries.
