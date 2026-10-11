// Phase 8A token contrast validation (WCAG 2.2 AA).
// Computes WCAG contrast ratios for canonical token pairs in
// theme/tokens.css under their INTENDED usage:
//   - text-safe variants (--tm-*-text) carry normal-size text (≥4.5:1),
//   - brand hexes carry large/bold text or non-text UI (≥3:1).
// Run: node scripts/phase-8a-contrast-check.js
// Output feeds docs/phase-8a-token-contrast-report.md.
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Canonical light-theme tokens (theme/tokens.css :root).
const t = {
  bg: '#f4f7fb',
  surface: '#ffffff',
  surface2: '#eef3f8',
  text: '#102033',
  muted: '#5f6f82',
  border: '#d7e0ea',
  primary: '#14233c',
  primary2: '#377de0',
  primary2Text: '#2d6ac9',
  teal: '#26a889',
  tealText: '#1b8069',
  accent: '#f59e0b',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
};

const checks = [
  // --- Normal-size text: ≥4.5:1 ---
  ['text', 'body text on page background', t.text, t.bg, 4.5],
  ['text', 'body text on surface', t.text, t.surface, 4.5],
  ['text', 'body text on surface-2', t.text, t.surface2, 4.5],
  ['text', 'muted text on surface', t.muted, t.surface, 4.5],
  ['text', 'muted text on surface-2', t.muted, t.surface2, 4.5],
  ['text', 'disabled text (muted) on surface', t.muted, t.surface, 4.5],
  ['text', 'disabled text (muted) on surface-2', t.muted, t.surface2, 4.5],
  ['text', 'white text on primary (nav/buttons)', '#ffffff', t.primary, 4.5],
  ['text', 'primary text on surface (links/values)', t.primary, t.surface, 4.5],
  ['text', 'primary text on page background', t.primary, t.bg, 4.5],
  ['text', 'white on primary-2-text (small text on interactive fill)', '#ffffff', t.primary2Text, 4.5],
  ['text', 'primary-2-text on surface (links/eyebrow)', t.primary2Text, t.surface, 4.5],
  ['text', 'primary-2-text on page background', t.primary2Text, t.bg, 4.5],
  ['text', 'white on teal-text (verified chips w/ small text)', '#ffffff', t.tealText, 4.5],
  ['text', 'teal-text on surface (verified label)', t.tealText, t.surface, 4.5],
  ['text', 'teal-text on page background', t.tealText, t.bg, 4.5],
  ['text', 'white text on success', '#ffffff', t.success, 4.5],
  ['text', 'success text on surface', t.success, t.surface, 4.5],
  ['text', 'success text on page background', t.success, t.bg, 4.5],
  ['text', 'white text on warning', '#ffffff', t.warning, 4.5],
  ['text', 'warning text on surface', t.warning, t.surface, 4.5],
  ['text', 'warning text on page background', t.warning, t.bg, 4.5],
  ['text', 'white text on danger', '#ffffff', t.danger, 4.5],
  ['text', 'danger text on surface', t.danger, t.surface, 4.5],
  ['text', 'danger text on page background', t.danger, t.bg, 4.5],

  // --- Brand hexes as large/bold text or non-text UI: ≥3:1 (WCAG 1.4.3
  // large-text exemption / 1.4.11 non-text contrast) ---
  ['non-text/large', 'brand blue as large-text fill / non-text UI on surface', t.primary2, t.surface, 3.0],
  ['non-text/large', 'brand blue on page background', t.primary2, t.bg, 3.0],
  ['non-text/large', 'white on brand blue (large/bold button text only)', '#ffffff', t.primary2, 3.0],
  // Meaningful teal UI (chip borders, small fills that identify state) must
  // use --tm-teal-text; brand teal is decorative-only on light surfaces.
  ['non-text/large', 'teal-text as meaningful UI on surface', t.tealText, t.surface, 3.0],
  ['non-text/large', 'teal-text as meaningful UI on page background', t.tealText, t.bg, 3.0],

  // --- Meaningful status distinguishability (not color-alone proxy; the
  // product rule also requires non-color status indicators) ---
  ['status-adjacency', 'teal vs success distinguishable', t.teal, t.success, 1.2],
  ['status-adjacency', 'warning vs danger distinguishable', t.warning, t.danger, 1.2],
];

// Known exceptions (retained legacy values, documented in the report).
// These are NOT required to pass in this PR; remediation is scheduled in the
// component-migration workstreams, not the token-value PR.
const exceptions = [
  ['exception', 'amber focus ring on surface (1.4.11 wants ≥3:1)', t.accent, t.surface, 3.0],
  ['exception', 'amber focus ring on page background', t.accent, t.bg, 3.0],
  ['exception', 'border on surface (decorative divider; control borders migrate later)', t.border, t.surface, 3.0],
  ['exception', 'border on page background', t.border, t.bg, 3.0],
  // Brand teal is mandated by the approved palette but measures <3:1 on
  // light surfaces. Rule: decorative/large-fill only; meaningful UI uses
  // --tm-teal-text (validated in required checks above).
  ['exception', 'brand teal as non-text UI on surface (decorative only)', t.teal, t.surface, 3.0],
  ['exception', 'brand teal on page background (decorative only)', t.teal, t.bg, 3.0],
];

let failures = 0;
for (const [kind, label, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) failures += 1;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}\t[${kind}]\t${r.toFixed(2)}:1\t(min ${min})\t${label}\t${fg} on ${bg}`
  );
}
console.log('');
for (const [kind, label, fg, bg, min] of exceptions) {
  const r = ratio(fg, bg);
  console.log(
    `KNOWN-EXCEPTION\t[${kind}]\t${r.toFixed(2)}:1\t(wants ${min})\t${label}\t${fg} on ${bg}`
  );
}
console.log(`\n${failures} failure(s) out of ${checks.length} required checks.`);
process.exit(failures > 0 ? 1 : 0);
