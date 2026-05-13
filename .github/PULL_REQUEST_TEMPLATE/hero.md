## Pull Request — Hero CTA (HERO-001)

**Related issue:** HERO-001 — Define behavior & UX spec

### Summary
Brief description of the change and which Hero CTA behavior it implements (scroll | demo-load | open-scenario).

---

### Implementation checklist
- [ ] Implements behavior described in `docs/hero-cta.md` (link in issue)
- [ ] Updates `index.html` CTA markup (if applicable)
- [ ] Adds/updates `js/hero.js` or `js/scenario-loader.js` as required
- [ ] Adds/updates styles in `theme.css`
- [ ] Adds/updates tests under `tests/` and they pass (`npm test`)
- [ ] Adds telemetry calls and documents them in `docs/telemetry.md` (if applicable)
- [ ] Includes accessibility changes and attaches `axe` report

---

### PR checklist (for reviewers)
- [ ] Implementation matches the UX spec in `docs/hero-cta.md`
- [ ] No critical `axe` violations (attach report)
- [ ] Keyboard flow works: Tab → Enter/Space activates CTA and focus moves correctly
- [ ] Loading/debounce behavior prevents duplicate activations and exposes `aria-busy`
- [ ] Telemetry events emitted with expected schema (no PII)
- [ ] Visuals validated across responsive breakpoints (mobile/tablet/desktop)
- [ ] Unit/e2e tests added and passing

---

### Testing steps
1. Checkout this branch and run the app locally (dev server):

```bash
npm ci
npm run dev
```

2. Visit the homepage and exercise the Hero CTA for each mode (scroll, demo-load, open-scenario).
3. Verify focus management and keyboard activation.
4. Validate telemetry events via the analytics debug view or mocked `window.analytics.track`.
5. Run `npm test` and confirm tests pass.

---

### Screenshots / Notes
- Add screenshots or short gif demonstrating the behavior.
- Note any known edge-cases or limitations and recommended follow-ups.

---

### Sign-off
- [ ] Product/UX: @product-owner
- [ ] Accessibility: @a11y-owner
- [ ] Reviewer: @reviewer

*Use this template for PRs that implement or change Hero CTA behavior.*
