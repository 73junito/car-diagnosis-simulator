# Coding Standards

## General Principles

* Prefer readability over brevity.
* Avoid unnecessary abstractions.
* Keep functions focused on one responsibility.
* Prefer pure functions when possible.

---

## JavaScript Standards

Use:

```js
const result = calculateScore(data);
```

Avoid:

```js
var result = calculateScore(data);
```

Use:

```js
const value = condition ? a : b;
```

Avoid deeply nested if statements.

---

## Error Handling

Use:

```js
try {
  await save();
} catch (err) {
  console.error(err);
}
```

Never silently swallow errors.

---

## Async Standards

Use:

```js
await fetchData();
```

Prefer async/await over promise chains.

---

## Naming

Use descriptive names:

```js
calculateStudentProgress()
```

Avoid:

```js
calc()
```

---

## Testing Requirements

Every feature change should include:

* Unit tests
* Integration tests when applicable
* Playwright tests for UI changes

---

## Pull Request Requirements

Include:

* Summary
* Risk assessment
* Validation steps

---

## Security

Never:

* Hardcode secrets
* Commit API keys
* Disable authentication checks

Always validate:

* User input
* Request payloads
* External responses

---

## AI Agent Guidance

Generated code should:

* Match existing style
* Include validation
* Include tests where appropriate
* Avoid introducing technical debt
