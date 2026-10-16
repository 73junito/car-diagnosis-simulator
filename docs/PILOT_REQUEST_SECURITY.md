# Pilot-request API security configuration

The Node API handler in `api/request-pilot.js` is distinct from Cloudflare Worker routes; first verify the hosting route and callers before enabling this handler in production.

- `PILOT_ALLOWED_ORIGINS`: optional comma-separated exact origins (for example `https://autolearnpro.com,https://app.autolearnpro.com`). By default, only the request's own origin is eligible for CORS; requests without `Origin` remain usable by server-to-server clients. Wildcard CORS is never emitted.
- `PILOT_TRUST_PROXY`: default false. Set to `true` **only** when every ingress request passes through a trusted reverse proxy that reliably replaces `CF-Connecting-IP` and `X-Forwarded-For`; otherwise malicious client-supplied headers could bypass local limiting. The remote socket address is the default key.

**Rate-limit gap remains:** Current `rateMap` is per Node process. A production-shared, atomic rate limiter (e.g. trusted edge Cloudflare WAF rate limiting or a dedicated durable backend) must be configured and validated separately. This PR does **not** provide distributed enforcement, and the local limiter is not sufficient alone for scaled production. Evaluate the actual route, identity source, handling of IPv6, cost, and storage policy before enabling a remote solution. Do not infer that a Cloudflare Durable Object limiter already protects this Node API.

Verify preflight, cross-origin GET/POST, credentials, and legitimate pilot submissions on the actual deployed route before merge.
