# GitHub Actions Patterns

## Repository Standards

* All pull requests must pass:

  * Lint
  * Unit Tests
  * Playwright Tests
  * API Smoke Tests
  * CodeQL
  * CI Workflow Validation

* Prefer fixing root causes rather than adding retries.

* Avoid disabling tests unless a documented issue exists.

---

## Workflow Debugging Process

When a GitHub Actions workflow fails:

1. Identify the failing workflow.
2. Identify the failing job.
3. Identify the failing step.
4. Capture exact error messages.
5. Determine whether the failure is:

   * Build failure
   * Test failure
   * Dependency failure
   * Environment failure
   * Configuration failure
   * Secret or credential failure
6. Recommend the smallest safe fix.

---

## Playwright CI Standards

Preferred patterns:

```js
await expect(locator).toBeVisible();
await expect(locator).toHaveValue('');
```

Avoid:

```js
await page.waitForTimeout(5000);
```

Prefer:

```js
await expect(locator).toBeVisible({
  timeout: 15000
});
```

Use Playwright auto-waiting whenever possible.

---

## Test Failure Investigation

For failed tests:

* Review screenshots.
* Review traces.
* Review page snapshots.
* Review console errors.
* Review page errors.

Determine whether failure is:

* Product bug
* Test bug
* Timing issue
* Selector issue
* Environment issue

---

## GitHub Actions Best Practices

Use:

```yaml
timeout-minutes: 15
```

Use:

```yaml
strategy:
  fail-fast: false
```

Cache dependencies when possible.

Avoid unnecessary workflow duplication.

---

## Common Failure Categories

### Dependency Failure

Examples:

* npm install failure
* package-lock conflicts
* missing package

Recommended actions:

* verify package.json
* verify lock file
* clear cache

---

### Playwright Failure

Examples:

* element not visible
* stale selector
* timeout

Recommended actions:

* use locator assertions
* remove waitForTimeout
* wait for actual UI state

---

### Node Version Mismatch

Verify:

```yaml
uses: actions/setup-node@v4
```

Ensure local Node version matches CI.

---

### Workflow Syntax Errors

Check:

```bash
npx yaml-lint .github/workflows/*.yml
```

Verify:

* indentation
* matrix syntax
* env syntax
* outputs syntax

---

## Repository-Specific Knowledge

Project: Car Diagnosis Simulator

Critical Areas:

* dashboard/student.js
* dashboard/student.html
* dashboard/student.css
* api/*
* services/*
* core/*
* tests/playwright/*
* tests/unit/*

Most recent CI failures should be checked against:

* Playwright dashboard tests
* Student dashboard filtering
* Reset filter behavior
* Telemetry APIs
* GitHub workflow validation

---

## Expected Agent Output

Every GitHub Actions investigation should include:

1. Root Cause
2. Evidence
3. Recommended Fix
4. Risk Assessment
5. Validation Steps
6. Commands To Reproduce Locally
