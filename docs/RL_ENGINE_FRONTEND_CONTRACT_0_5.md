# Rocket League engine-to-frontend contract 0.5

Status: handoff contract only. This document does not authorize a frontend
change, detector activation, public coaching-policy change or release.

## Runtime statuses

Every shadow run exposes `implementationStatus`, `status`, `candidateCount`,
`measurements`, `evidence` and `qualityGate`.

| `implementationStatus` | `status` | Meaning | Customer interpretation |
| --- | --- | --- | --- |
| `measuring` | `observed` | Private telemetry produced one or more candidate observations. | Not automatically a finding; require the full quality and activation gate. |
| `measuring` | `no_signal` | A measuring implementation ran and produced no positive candidate. | Only opportunity-contract detectors may support a measured non-firing denominator. Episode-only detectors do not prove absence. |
| `capability_abstention` | `capability_abstained` | Required gameplay model or opportunity denominator is incomplete. No opportunity was classified. | Must never render as “no issue”, “passed”, “clean” or equivalent. |
| either | `not_applicable` | The detector does not apply to this canonical mode. | Omit from measured coverage for that replay. |
| either | `error` | The lane failed in isolation. | Do not infer gameplay truth; preserve retry/diagnostic handling. |

`capability_abstained` remains the material contract change. Frontend consumers
must keep it distinct from `no_signal`. Engine 0.6 has 20 measuring lanes and
40 capability-abstaining lanes, but no detector is formally public.

## Opportunity metadata

Only real opportunity-contract detectors appear in
`decisionEngineMetadata.detectors`. Each contract includes:

- detector and detector-version identity;
- opportunity-contract schema version;
- firing, non-firing and abstention counts against one denominator;
- duplicate-opportunity and integrity fields;
- context keys built from the versioned decision-context schema.

Current schema identities are:

- analyzer, detector bundle and shadow runtime: `0.6.0`;
- decision context: `rocket-league-decision-context@0.4.0`;
- opportunity contract: `rocket-league-opportunity-contract@0.2.0`;
- Pattern Memory: `0.2.0`;
- replay-batch aggregation: `1.3.0`.

The frontend must not calculate or display precision, recall, false-positive
rate, agreement or “accuracy” from these raw counts. Those fields remain
unavailable until independent labels and the frozen evaluation protocol exist.

## Public-output gate

The existing customer-output rule remains unchanged:

1. `qualityGate.eligible` must be true;
2. the exact detector version must have a valid activation record and kill
   switch;
3. mode, dependencies, sample size and evidence must pass finding policy;
4. language may explain verified findings but may not create gameplay facts.

No 0.5 detector currently passes that gate. The frontend task should therefore
treat this contract as forward-compatible plumbing, not permission to expose
new coaching claims.
