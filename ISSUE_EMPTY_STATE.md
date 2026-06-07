Title: UX: Review empty-state auto-scroll and reset-button placement

## Background
A Playwright test failure exposed an actionability issue in the student dashboard empty-state flow. When filters produced no results, the reset button could be rendered outside the visible viewport, preventing reliable interaction.

To address this, the dashboard now:

- Scrolls the empty-state into view.
- Focuses the reset button.
- Dispatches input/change events when filters are reset.

This resolved the interaction issue and stabilized the Playwright test.

## Question
Is automatic scrolling and focus management the desired user experience, or should the reset control be repositioned closer to the filter controls?

## Current Behavior

1. Enter a search term that produces no matches.
2. Empty-state appears.
3. Page scrolls the empty-state into view.
4. Reset button receives focus.

## Options

### Option A — Keep current behavior

- Maintains accessibility improvements.
- Ensures reset action is immediately visible and actionable.

### Option B — Relocate reset control

- Place reset action near filter inputs.
- Avoid automatic scrolling.
- May provide a more predictable experience.

### Option C — Adjust layout

- Keep empty-state visible without requiring page scrolling.
- Preserve current reset workflow while reducing viewport jumps.

## Acceptance Criteria

- Reset action is reliably actionable with keyboard and pointer input.
- Empty-state flow remains Playwright-testable using standard locator clicks.
- UX behavior is reviewed and explicitly approved.
