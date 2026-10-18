# Performance considerations — AUT-250 interactive laboratory assets

These notes record measured behaviour and the deliberate limits built into the
assets. No benchmark figures are claimed beyond what the notes describe.

## Rendering model

- **Multimeter.** Renders only when `setMeasurement` or `setDisplayUnit` is
  called. There is no timer, interval, or animation loop. DOM nodes are
  created once per mount and updated in place with `textContent`.
- **Oscilloscope.** Redraws on demand (data change, control change, or an
  animation frame during the reveal). The reveal animation runs for a fixed
  700 ms and then stops; it does not run continuously.
- **Scan tool.** Rebuilds only the affected panel bodies on `setData` or
  `clear`. Tables are replaced wholesale, which keeps the code simple and
  avoids partial-update bugs.
- **Component library.** Builds one `button` per supplied component on
  `setComponents`. Selection and highlight update classes and `aria-pressed`
  only; they never rebuild the grid.

## Deliberate limits

| Area | Limit | Reason |
| --- | --- | --- |
| Oscilloscope trace | Draws one line segment per supplied sample | The assets do not resample, interpolate, or smooth supplied data. A provider supplying 100,000 points will produce a dense trace. |
| Oscilloscope animation | Progressive reveal capped at the sample count | Reveal is presentation only; the final frame is deterministic. |
| Sample table | First 50 samples, with the total stated | Keeps the DOM and screen-reader output bounded. |
| Scan tool rows | No cap | Providers supply bounded result sets; the panel is not designed for bulk data. |
| Component grid | One button per component | The showcase supplies 13; classroom-scale libraries should be paginated or filtered before integration. |

## Provider guidance

- Prefer decimated or pre-averaged waveforms sized to roughly the display
  width. A 480 px canvas does not benefit from tens of thousands of samples.
- Supply `vertical.min` and `vertical.max` when a stable display scale matters.
  Otherwise the scope derives the scale from the supplied minimum and maximum,
  which can shift between payloads.
- Keep `liveData` to the parameters a student actually reads; each entry is a
  table row.
- Supply `timeUnit` so the time axis and descriptions are labelled correctly.

## Cost profile

- No third-party runtime dependency, no bundler, no framework.
- Total added source is a few thousand lines of plain ES5-compatible
  JavaScript plus one stylesheet.
- No network requests, no storage writes, and no background work at idle.

## Verification performed

- Isolated Jest suite covering rendering, input handling, rejection paths, and
  interaction state.
- `node --check` syntax validation for every source file.
- Scoped ESLint run over the owned JavaScript files.

## Not yet measured

1. Frame timing on low-powered classroom hardware.
2. Behaviour with provider payloads above the recommended sample counts.
3. Memory profile of repeated `setData`/`clear` cycles over a long session.
4. Interaction cost when several assets are mounted simultaneously in the
   integrated shell.

These should be measured during integration rather than assumed.
