# LMF retention operator safeguard

`createReferenceRetentionJob` is a server-only, disabled-by-default wrapper for the private PostgreSQL cleanup function. Execution requires both an enabled configuration and explicit approval for that invocation. Batches are limited to 1–1000; completion records a timestamp and aggregate deletion count, while failure records a generic error code without student identifiers or secrets.

**Not scheduled or deployed.** `approved:true` is a call-site operational gate, not proof of independent policy approval or authenticated human authorization; the invoking job platform must enforce those controls. Before activation, confirm policy-defined retention, appropriate deletion notices and backups, secret handling, a privileged job identity, durable audit monitoring, and database testing.
