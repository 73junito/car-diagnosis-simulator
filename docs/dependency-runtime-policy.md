# Dependency and Runtime Compatibility Policy

## Supported Node baseline

The root application and the legacy `torquemind-api` require Node.js **22.19.0 or newer**. CI intentionally exercises Node 22 and Node 24. The repository-level `.nvmrc` pins 22.19.0 as the minimum local-development baseline.

## Production runtime dependencies

Packages imported by the canonical Cloudflare Worker must be declared under `dependencies`, not only `devDependencies`.

Current Worker runtime dependencies include:

- `hono`
- `@supabase/supabase-js`

The compatibility guard treats the currently reviewed versions as **minimum floors**, not permanent point-version pins. Routine Dependabot minor/patch updates may move these dependencies forward within their reviewed major version when the declared range remains a caret range, the lockfile satisfies that range, and all runtime/CI gates pass. Major-version changes require a dedicated runtime review.

Build/test/deployment tooling remains under `devDependencies`.

## Legacy TorqueMind API

`torquemind-api` is retained for legacy/test coverage and is not the canonical production Worker runtime. Its Node floor is aligned with the root project. Its Supabase client is pinned to the currently reviewed lockfile version (`2.105.1`) to prevent an unconstrained `^2.0.0` range from silently crossing future Node-support boundaries.

## npm overrides

The root package currently carries three transitive overrides. They are not permission to upgrade the underlying parent packages independently.

| Override | Current value | Parent pressure | Compatibility rule |
| --- | --- | --- | --- |
| `lodash-es` | `4.18.1` | Chevrotain / dagre tooling requests 4.17.x | Development tooling only; keep covered by Node 22/24 CI. |
| `katex` | `0.18.9` | Mermaid / Mermaid CLI request 0.16.x | Higher-risk 0.x override; Mermaid rendering validation must pass before changing or retaining this override in a dependency update. |
| `sharp` | `0.35.5` | Miniflare requests 0.35.4 | Patch-level development-tool override; Wrangler/static preview checks must remain green. |

Do not broaden, remove, or bump these overrides as part of unrelated feature work. Any change must include the relevant rendering/build validation.

## Security advisory handling

Root `npm audit` currently reports a reviewed moderate-severity Jest/Istanbul development-only chain ending in `sprintf-js`. The repository's `validate:dependency-security-exceptions` gate verifies the exact reviewed chain and prohibits it from becoming a production or direct dependency.

The legacy `torquemind-api` lockfile currently reports no npm audit vulnerabilities.

## Required compatibility checks

Before dependency/runtime changes merge:

1. `npm ci --dry-run --ignore-scripts`
2. `npm run validate:dependency-runtime-compatibility`
3. `npm run validate:dependency-security-exceptions`
4. `npm run build`
5. `npm test`
6. `npm run docs:mermaid` when Mermaid/KaTeX/sharp/transitive rendering dependencies change
7. CI must remain green on Node 22 and Node 24
