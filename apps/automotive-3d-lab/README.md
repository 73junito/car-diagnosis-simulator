# AutoLearnPro 3D Lab — Milestone A

An isolated training-only React 19 / React Three Fiber 9 / Drei 10 / Three.js pilot. No credential, database, assessment or production API integration.

## Docker

```sh
docker compose config --quiet
docker compose build lab
docker compose up -d lab
# Open http://127.0.0.1:5173
```

Production-style static preview: `docker compose --profile preview up --build -d preview` (http://127.0.0.1:4173). Shut down with `docker compose --profile preview down`.

## Local tests

```sh
npm ci
npm test
npm run build
```

The reference battery model is intentionally simplified and must not be used as an assessment authority. Before production promotion, pin Docker base images by verified digest, validate accessibility and cross-browser performance, and add integration checks.
