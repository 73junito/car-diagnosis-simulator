# Student Dashboard Enhancements Checklist

## Phase 1 — UX / Dashboard Improvements

- Review current dashboard layout and identify pain points
- Improve card spacing, responsiveness, and mobile layout
- Add loading / empty states
- Improve error handling and user feedback

## Phase 2 — Data & Telemetry

- Improve telemetry event visibility
- Add session summaries to dashboard view
- Validate Supabase telemetry flows
- Add fallback behavior for missing data

## Phase 3 — Testing

- Add/expand Jest coverage for dashboard interactions
- Expand Playwright smoke coverage
- Validate mobile layouts
- Run full CI validation before merge

## Phase 4 — Release Readiness

- Update screenshots/docs if UI changes
- Run build verification
- Verify production deployment
- Open PR from feature branch

### Suggested workflow

```sh
# create checklist file
mkdir -p docs
# save checklist as docs/student-dashboard-checklist.md

git add docs/student-dashboard-checklist.md
git commit -m "docs: add student dashboard enhancement checklist"
git push
```

After the first commit, create a draft PR:

```sh
gh pr create \
  --draft \
  --base main \
  --head feature/student-dashboard-enhancements \
  --title "feat: student dashboard enhancements" \
  --body "Initial dashboard enhancement work. Tracking checklist and incremental improvements."
```

Keep the PR small and iterate on the checklist-driven tasks.
