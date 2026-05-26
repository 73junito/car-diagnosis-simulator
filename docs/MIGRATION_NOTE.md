# Migration Note for Contributors
### DOM‑Safety Conventions & Lint Expectations

This project now enforces strict DOM‑safety and linting rules to ensure security, maintainability, and consistency. All contributors should follow the conventions below when writing or modifying code.

---

## 1. DOM‑Safety Rules

### Avoid all HTML injection
Never use:
- `innerHTML`
- `outerHTML`
- `insertAdjacentHTML`
- template‑string HTML (e.g., `` `<div>${x}</div>` ``)

These patterns are banned because they create DOM‑XSS vectors.

### Use safe DOM construction
Always build nodes using:
- `document.createElement`
- `element.textContent`
- `element.appendChild`
- `element.replaceChildren`

Example:

```js
const row = document.createElement('tr');
const cell = document.createElement('td');
cell.textContent = student.name;
row.appendChild(cell);
tbody.appendChild(row);
```

### Clearing DOM nodes
Instead of:

```js
tbody.innerHTML = '';
```

Use:

```js
while (tbody.firstChild) tbody.firstChild.remove();
```

---

## 2. Lint Expectations

### Zero‑warning lint policy
All code must pass:

```
npm run lint -- --max-warnings=0
```

### Empty blocks
Empty `catch` or `if` blocks must contain a harmless no‑op:

```js
} catch (e) {
  void e;
}
```

### Unused variables
Remove them, or prefix with `_` if intentionally unused:

```js
const _unused = value;
```

### Undefined globals
Browser globals must be referenced via:

```js
globalThis.someGlobal
```

### Inner function declarations
Do not declare functions inside blocks. Use function expressions instead:

```js
const helper = () => { ... };
```

---

## 3. Test Fixture Conventions

### No `innerHTML` in tests
Tests must construct DOM fixtures programmatically:

```js
const root = document.createElement('div');
document.body.appendChild(root);
```

### Unused imports
Remove unused imports and locals to avoid `no-unused-vars`.

---

## 4. Summary

These conventions ensure:

- No DOM‑XSS vulnerabilities  
- Predictable, maintainable code  
- Clean lint output  
- Stable test fixtures  
- Consistent patterns across the entire codebase  

Following these rules keeps the project secure and prevents regressions.

---

If you want, I can also generate a short commit summary for maintainers or a `RELEASE_NOTES.md` file with the release body used for the GitHub release.