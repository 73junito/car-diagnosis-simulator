# Phase B: explicit staging deployment targets

The legacy staging deployment script previously executed `wrangler deploy --env staging` without a config, implicitly using `wrangler.jsonc` and deploying `car-diagnosis-simulator-staging`.

The supported app staging Worker is `autolearnpro-app-staging` in `wrangler.app.jsonc`. The updated script checks these target names first and **does not deploy by default**.

Preview the deployment contract without network mutation:

```powershell
powershell -File scripts/deploy-and-test-staging.ps1
```

To intentionally build, deploy and issue the preexisting live POST smoke probe:

```powershell
powershell -File scripts/deploy-and-test-staging.ps1 -Deploy
```

This opt-in operation has not been executed as part of this change. A production deployment must use a different, explicitly reviewed workflow and configuration. The old legacy staging Worker and its DO namespace remain untouched; no migrations or deletion.

`scripts/probe-staging.ps1` now targets modern app staging. It makes a POST request and is **not** a read-only audit. Its operation must be deliberate.

Before invoking `-Deploy`, verify required staging secrets, build artifacts, and API dependencies. The live smoke POST response may fail due to auth or feature policy; such failure must not justify changing production flags or disabling authorization.
