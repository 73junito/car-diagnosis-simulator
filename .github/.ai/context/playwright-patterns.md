# Playwright Testing Patterns

## Preferred Assertions

Use:

```js
await expect(locator).toBeVisible();
```

Use:

```js
await expect(locator).toHaveValue('');
```

Use:

```js
await expect(locator).toContainText('Expected');
```

---

## Preferred Selectors

Use:

```js
page.getByRole('button', { name: 'Reset filters' })
```

Use:

```js
page.getByLabel('Search')
```

Use:

```js
page.locator('#searchInput')
```

Avoid fragile CSS chains.

---

## Auto Waiting

Prefer:

```js
await expect(locator).toBeVisible();
```

Instead of:

```js
await page.waitForTimeout(5000);
```

---

## Dashboard Testing

Verify:

* Filters
* Search
* Scenario cards
* Empty states
* Progress indicators
* Keyboard accessibility

---

## Error Collection

Use:

```js
const pageErrors = [];
const consoleErrors = [];

page.on('pageerror', err => {
  pageErrors.push(err.message);
});

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});
```

---

## Preferred Investigation Process

1. Reproduce failure.
2. Review page snapshot.
3. Review trace.
4. Review screenshot.
5. Review console errors.
6. Review page errors.
7. Identify root cause.

---

## Common Failure Types

### Selector Failure

Fix locator strategy.

### Timing Failure

Wait for UI state, not time.

### Application Bug

Fix application logic.

### Test Bug

Fix test assumptions.

---

## Student Dashboard Knowledge

Critical files:

* dashboard/student.html
* dashboard/student.js
* dashboard/student.css

Critical tests:

* student-dashboard-reset.spec.js
* student-dashboard-filter.spec.js
* student-dashboard-smoke.spec.js

---

## AI Agent Guidance

When Playwright fails:

* Determine whether the bug is in the test or application.
* Prefer locator assertions.
* Avoid page.evaluate unless necessary.
* Avoid waitForTimeout unless no alternative exists.
* Recommend reproducible fixes.
