# Vehicle Data Gateway Interface (Design Only)

Status: Gate 2B design specification. **Not implemented.**
Scope: recorded-data import now; authorized read-only hardware later

## Purpose

Define the interface through which vehicle observations enter the platform, so
that Diagnostic and Integrated modes can be built later without redefining the
evidence model.

Gate 2B implements **no** vehicle communication and **no** new persistence. This
document specifies the interface and its security requirements only.

## Two entry paths

| Path | Availability | Description |
| --- | --- | --- |
| Recorded-data import | specified in Gate 2B, implemented in a later gate | CSV, JSON, or supported diagnostic log files parsed into an `ObservationSession` |
| Authorized local gateway | later authorized stage only | A local adapter process that reads OBD-II, CAN, LIN, J1939 or DoIP data in read-only mode |

Both paths produce the same `ObservationSession` shape, so downstream evidence
handling is identical.

## Security requirements for any hardware gateway

1. **Device authentication** before any data exchange.
2. **Capability negotiation** — the gateway declares which parameters and
   transports it supports; the platform never assumes a capability.
3. **Read-only by default.** The first hardware-connected release performs no
   ECU programming, no actuator actuation, no diagnostic clearing, and no
   vehicle control.
4. **Bounded resources** — bounded buffering, bounded request rates, and
   bounded session length.
5. **Fail closed** — an unsupported capability, an unknown protocol, an
   authentication failure, or a lost connection returns a declared failure
   rather than a partial or invented session.
6. **No service-role credentials in the browser.** Any privileged access is
   mediated server-side.
7. **Authorization is explicit.** Access requires an authorized user and an
   explicit interface declaration with `requiresAuthorization: true`.

## Explicitly out of scope unless separately authorized

- actuator commands
- ECU programming or flashing
- diagnostic trouble-code clearing
- immobilizer or security-access functions
- any safety-critical vehicle control

## Data flow

```text
recorded file or authorized gateway
        |
   import adapter  ->  ObservationSession
        |                 observations, quality flags, reported DTCs
        v
   normalization   ->  units, timestamps, parameter identity preserved
        v
   evidence layer  ->  compared with model predictions (Integrated Mode)
```

## Data-quality and time handling

- Every observation carries a timestamp, an origin, a source role, and a
  quality flag (`clean`, `stale`, `interpolated`, `substituted-default`,
  `out-of-range`, `suspect`).
- A non-clean observation must carry a reason. An unqualified observation is
  never treated as equivalent to a clean one.
- Reported DTCs are recorded **verbatim** and are never converted into a
  diagnosis by the import path.
- Time alignment between predictions and observations is explicit; a comparison
  that cannot be aligned is reported as not comparable rather than silently
  matched.

## Privacy

- Observations are vehicle data, not student identity data. The interface
  carries no student personally identifiable information.
- Any persistence introduced later must use the existing retention and deletion
  contracts and must be separately approved.
- Recorded data supplied by a student is treated as practice evidence and never
  as an assessment record.

## Acceptance criteria for the future gateway gate

| # | Criterion |
| --- | --- |
| G1 | Authentication is enforced before any data exchange |
| G2 | Capability negotiation prevents any unsupported request from being attempted |
| G3 | Unsupported, malformed, or unauthenticated input fails closed with a declared code |
| G4 | No write, actuation, programming, or clearing capability exists in the released surface |
| G5 | Buffering, rate, and session length are bounded and tested |
| G6 | Disconnect and reconnect recovery is defined and tested |
| G7 | Quality flags and timestamps survive import without loss or invention |
| G8 | No student personally identifiable information crosses the interface |
| G9 | Security review completed independently of the engineering review |
