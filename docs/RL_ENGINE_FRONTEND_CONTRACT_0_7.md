# Rocket League engine-to-frontend contract 0.7

Status: handoff contract only. This document does not authorize a frontend
change, detector activation, public coaching-policy change or release.

## Runtime statuses

Every shadow run exposes `implementationStatus`, `status`, `candidateCount`,
`measurements`, `evidence` and `qualityGate`.

| `implementationStatus` | `status` | Meaning | Customer interpretation |
| --- | --- | --- | --- |
| `measuring` | `observed` | Private telemetry produced one or more firing observations. | Not automatically a finding; require the full quality and activation gate. |
| `measuring` | `no_signal` | A measuring contract ran with no firing observation. | May contain non-firing and/or abstained opportunities; inspect contract counts rather than treating it as “clean”. |
| `capability_abstention` | `capability_abstained` | Required gameplay model or opportunity denominator is incomplete. No opportunity was classified. | Must never render as “no issue”, “passed”, “clean” or equivalent. |
| either | `not_applicable` | The detector does not apply to this canonical mode. | Omit from measured coverage for that replay. |
| either | `error` | The lane failed in isolation. | Do not infer gameplay truth; preserve retry/diagnostic handling. |

Engine 0.7 has 20 measuring opportunity contracts and 40
capability-abstaining lanes. Every measuring lane has firing, non-firing and
explicit abstained decisions; `status: no_signal` alone still does not mean
that every opportunity was judged negative. No detector is formally public.

## Opportunity metadata

Only real opportunity-contract detectors appear in
`decisionEngineMetadata.detectors`. Each contract includes:

- detector and exact detector-version identity;
- opportunity-contract and decision-context schema identity;
- firing, non-firing and abstention counts against one denominator;
- duplicate-opportunity and integrity fields;
- canonical context keys and evidence/reason fields.

Current schema identities are:

- analyzer, detector bundle and shadow runtime: `0.7.0`;
- decision context: `rocket-league-decision-context@0.5.0`;
- tactical spatial: `rocket-league-tactical-spatial@0.2.0`;
- opportunity contract: `rocket-league-opportunity-contract@0.2.0`;
- Pattern Memory: `0.2.0`;
- replay-batch aggregation: `1.3.0`.

The frontend must not calculate or display precision, recall, false-positive
rate, agreement or “accuracy” from raw opportunity counts. Those metrics remain
unavailable until independent labels and the frozen evaluation protocol exist.

## Public-output gate

The customer-output rule remains unchanged:

1. `qualityGate.eligible` must be true;
2. the exact detector version must have a valid activation record and kill
   switch;
3. mode, dependencies, sample size and evidence must pass finding policy;
4. language may explain verified findings but may not create gameplay facts.

No 0.7 detector currently passes that gate. No customer-visible frontend
change is required for the private 0.7 checkpoint. If a future frontend task
surfaces contract coverage, it must render firing, non-firing, abstained,
capability-abstained, not-applicable and error as distinct states.

## Preview integration handoff

No React, CSS, copy or frontend-E2E change is required to connect the existing
worker adapter. The frontend/deployment task owns only environment wiring:

- `RL_ENGINE_ENABLED=true` in preview;
- an HTTPS `RL_ENGINE_URL` for the private engine host;
- the same 24–512-character `RL_ENGINE_TOKEN` in both secret managers;
- `RL_ENGINE_TIMEOUT_MS=90000`;
- `BACKGROUND_PROCESSING_ENABLED=true` for durable retries;
- `RL_PUBLIC_DETECTORS_ENABLED=false` and
  `RL_EARLY_ACCESS_OUTPUT_ENABLED=false`.

The preview must preserve a raw upload when the engine returns 202, 503 or a
network timeout and poll/retry the existing durable web job. Deployment must
not be represented as detector validation. The full host-side gate and current
runtime evidence are in `docs/RL_ENGINE_PRODUCTION_READINESS_2026-08-28.md`.
