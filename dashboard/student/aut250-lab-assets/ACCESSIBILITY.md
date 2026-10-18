# Accessibility notes — AUT-250 interactive laboratory assets

Target: WCAG 2.2 AA intent, consistent with the AutoLearnPro accessibility
priority. These notes describe implemented behaviour and the residual work
required before institutional pilot use.

## Keyboard operation

- Every control is a native `button`, `select`, `input`, or `label`-associated
  field. No custom widget replaces native semantics.
- The skip link (`Skip to asset showcase`) is the first focusable element.
- Focus is always visible: `:focus-visible` applies a 3px focus ring using
  `--tm-assets-focus` (text-safe blue) with a 2px offset.
- Component cards are `button` elements, so Tab reaches them, Enter and Space
  activate selection, and `aria-pressed` communicates the selected state.
- The oscilloscope transport button exposes `aria-pressed` for the paused
  state and changes its accessible name between `Pause` and `Resume`.
- Range, number, and select inputs accept keyboard input without pointer use.

## Non-visual alternatives

- **Oscilloscope.** The canvas is supplementary. A live text description
  reports, per channel, the supplied sample count, the time span, minimum,
  maximum, peak-to-peak, mean, and the applied vertical and time scales. The
  trigger description states the found crossing or the explicit reason none
  exists. A `<details>` element contains a table of the supplied samples, and
  the canvas `aria-label` repeats the same summary. Interpretation never
  depends on waveform appearance alone.
- **Multimeter.** The measured value, mode, test point, and provider quality
  flag are text. Continuity is stated as `CLOSED`/`OPEN` in words, not by
  colour. Leads carry visible text labels plus `aria-label` text on the lead
  group.
- **Scan tool.** All data is rendered as semantic tables with column headers;
  no value is conveyed by colour or icon alone.
- **Components.** Each card has an SVG with `role="img"` and a descriptive
  `aria-label`, plus a visually hidden description referenced by
  `aria-describedby`. Selection and highlight are conveyed by `aria-pressed`
  and the inspection panel text, not by border colour alone.

## Live regions

| Region | Role | Content |
| --- | --- | --- |
| Showcase status | `status`, `aria-live="polite"` | Result of each data-supply action, including rejections |
| Multimeter value | `status`, `aria-live="polite"` | Current displayed reading or "No measurement supplied" |
| Multimeter continuity | `status`, `aria-live="polite"` | Continuity state |
| Oscilloscope status and description | `status`, `aria-live="polite"` | Rendering state and waveform description |
| Scan tool issues | `status`, `aria-live="polite"` | Rejected-entry explanations |
| Component inspection | `aria-live="polite"` | Selected component facts |

Regions are polite so screen-reader users are not interrupted mid-sentence
while operating controls.

## Motion

- Probe animation and waveform reveal are purely presentational.
- `@media (prefers-reduced-motion: reduce)` disables the probe animation.
- When reduced motion is requested, the oscilloscope renders the complete
  supplied trace immediately instead of animating the reveal.
- No content or meaning depends on animation completing.

## Colour and contrast

- The page uses a local palette with a documented mapping to shared theme
  tokens in `INTEGRATION.md`.
- Instrument screens pair dark surfaces with light text; verify contrast
  against the shared tokens during integration.
- Trace colours differ in luminance as well as hue, and every trace also has a
  text description, so colour is never the sole differentiator.

## Responsive layout

- Multimeter and oscilloscope switch from two columns to one at 860px.
- Scan-tool panels and the component grid reflow with
  `repeat(auto-fit, minmax(...))`, so they adapt without horizontal scrolling.
- The component grid is the only horizontally dense region; it wraps rather
  than scrolls.

## Known limitations to address before pilot use

1. The oscilloscope waveform has no audio or sonified alternative.
2. No high-contrast or forced-colors mode has been verified.
3. Localisation and right-to-left layout have not been evaluated.
4. Manual screen-reader testing (NVDA, JAWS, VoiceOver) has not been performed;
   verification so far is structural and automated.
5. The sample table is capped at 50 rows with a stated total; a paginated or
   downloadable alternative should be reviewed with instructors.
