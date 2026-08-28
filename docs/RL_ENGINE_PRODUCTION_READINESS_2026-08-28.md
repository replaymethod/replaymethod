# Rocket League engine production-readiness record — 2026-08-28

Status: source- and local-process verified. This record does not authorize a
commit, push, provider deployment, public detector activation, coaching-policy
change or frozen-holdout access.

## Result

The Rocket League engine is a separately runnable authenticated service. The
web adapter submits a preserved replay, receives an asynchronous job contract,
polls the same job ID and persists either verified normalized match data or an
explicit blocked/abstained result. Public detector output and experimental
Early Access output remain independently off by default.

The hardened service reports `rl-engine.v1.1`. A later local engine-only 0.8
revision adds mechanics and ball-control shadow contracts; analyzer, detector
bundle and shadow runtime are now `0.8.0`. This does not change the service
transport contract or authorize public output.

The 2026-08-28 hardening pass closed three production defects:

1. accepted asynchronous work was not counted against process concurrency;
2. failed asynchronous job IDs remained cached and prevented the durable web
   job from retrying its preserved replay;
3. parser provenance reported handwritten `subtr-actor@1.2.2` while the locked
   and executed package was `1.2.0`.

The service now counts all accepted work, returns capacity as retryable before
accepting excess work, releases a failed result after it has been observed and
drains accepted work on shutdown up to a bounded deadline. Parser identity is
read from installed package metadata at startup.

## Runtime package boundary

`services/rl-engine/package-lock.json` pins the engine's only external runtime
dependency: `@rlrml/subtr-actor@1.2.0`. The container no longer installs the
web application's Next, React, Stripe or database packages. The checked-in
Dockerfile remains non-root, health-checked and SIGTERM-aware.

An isolated install from only the engine directory was verified locally:

- one production dependency installed;
- `/healthz` returned ready;
- reported parser was `subtr-actor@1.2.0`;
- default concurrency was 1;
- SIGINT completed with exit code 0.

Docker or another OCI builder was not installed on this workstation. The
actual image build and vulnerability scan therefore remain deployment gates,
not completed evidence.

## Corrected calibration provenance

Two complete runs selected only the manifest-locked `calibration_dev` split:

| Measure | Run A | Run B |
| --- | ---: | ---: |
| Real replays | 120/120 | 120/120 |
| Failures | 0 | 0 |
| Mean runtime | 4.80 s | 4.78 s |
| p50 runtime | 4.38 s | 4.41 s |
| p95 runtime | 8.68 s | 8.66 s |
| Maximum runtime | 24.79 s | 24.56 s |
| Maximum post-replay RSS | 810,369,024 B | 818,954,240 B |

Both runs reproduced:

- parser: `subtr-actor@1.2.0`;
- calibration fingerprint:
  `158a156c540e606f59abe91fdefc856ab4fdec2cc358165272769042d3674afa`;
- 66,359 evaluations: 7,704 firing, 43,572 non-firing and 15,083 abstained;
- outcome hash:
  `79c290df461044b5a6c26ef047842870455555bc98f70474b61e4977dfd4424d`.

The outcome hash also matches the earlier mislabeled runs. Correcting parser
provenance did not change a threshold, context, opportunity or gameplay
classification. Challenge and frozen holdout were not selected or opened.

## Engine 0.8 deterministic calibration

The later mechanics revision completed two fresh runs over the same explicit
`calibration_dev` assignment. Challenge and frozen holdout replay bytes were
not selected or opened.

| Measure | Run A | Run B |
| --- | ---: | ---: |
| Real replays | 120/120 | 120/120 |
| Failures / mode mismatches | 0 / 0 | 0 / 0 |
| Mean runtime | 4.844 s | 4.846 s |
| p50 runtime | 4.421 s | 4.456 s |
| p95 runtime | 8.680 s | 8.627 s |
| Maximum runtime | 24.974 s | 24.725 s |
| Maximum post-replay RSS | 846,397,440 B | 861,224,960 B |

Both runs reproduced fingerprint
`dd9a3fb39619f7101a0a09b5241253c2ecde7e2f6b3fbe085403488fe661e1a3`
and canonical outcome hash
`7a32f17000769fb5709f625201562f2d49ef17c7b500aa80fb56e7768a9771a7`.
They contain 83,557 opportunity evaluations across 25 measuring contracts:
7,823 firing, 50,715 non-firing and 25,019 abstained, with zero duplicate
opportunities or integrity failures. These counts establish deterministic
coverage, not detector accuracy.

The new private queue contains 2,788 model-blind candidates from all 25
contracts and 119 calibration replays. Its label set is
`rocket-league-expert-labels.v9-mechanics-context-0.6`; no current-version
expert decision exists yet.

## Previous engine 0.7 review-package replacement

The superseded but preserved 0.7 private review inputs are:

- `opportunity-review-queue-0.7-parser-truth.json`;
- `opportunity-review-moments-0.7-balanced-all-contracts.json`;
- `independent-review-plan-0.7-parser-truth.json`;
- `blind-reviewer-packets-0.7-parser-truth/reviewer-a.json`;
- `blind-reviewer-packets-0.7-parser-truth/reviewer-b.json`.

The 2,276 candidate payloads are byte-identical to the prior 0.7 candidate
payload, and all 2,276 IDs match the already anonymized moment set. Only the
replacement queue/plan/packets carry the corrected source fingerprint. Both
reviewer packets cover the same 2,276 candidates in eight independently
ordered rounds, contain no model status/classification/outcome fields and
require 4,552 independent decisions before adjudication.

## Final local verification

- engine tests: 94/94 passed;
- engine/web integration tests: 27/27 passed;
- full repository build and tests: 218/218 passed;
- full lint: zero errors and zero warnings;
- final real-replay service/client smoke: HTTP 202, bounded polling, HTTP 200;
- final real replay runtime: 4.99 seconds for a 1.15 MB Ranked Doubles replay;
- final output with both publication switches off: zero findings and explicit
  `public_output_disabled` abstention;
- service health: `rl-engine.v1.1`, `subtr-actor@1.2.0`, concurrency 1, job
  timeout 80,000 ms and shutdown timeout 30,000 ms;
- graceful SIGINT exit: code 0;
- source whitespace validation: passed.

## Safe preview configuration

Engine host:

```text
RL_ENGINE_TOKEN=<host-managed shared secret, 24–512 characters>
RL_ENGINE_MAX_CONCURRENCY=1
RL_ENGINE_JOB_TIMEOUT_MS=80000
RL_ENGINE_SHUTDOWN_TIMEOUT_MS=30000
RL_PUBLIC_DETECTORS_ENABLED=false
RL_EARLY_ACCESS_OUTPUT_ENABLED=false
PORT=8788
```

Web preview:

```text
RL_ENGINE_ENABLED=true
RL_ENGINE_URL=https://<private-engine-host>
RL_ENGINE_TOKEN=<same host-managed shared secret>
RL_ENGINE_TIMEOUT_MS=90000
RL_PUBLIC_DETECTORS_ENABLED=false
RL_EARLY_ACCESS_OUTPUT_ENABLED=false
BACKGROUND_PROCESSING_ENABLED=true
```

The web URL must use HTTPS outside loopback. Secrets must be injected through
each host's secret manager and must not appear in source, image layers, logs or
screenshots.

## Final engine 0.8 local verification

- engine tests: 107/107 passed;
- engine/web contract and production-boundary tests: 19/19 passed;
- scoped engine/calibration lint: zero errors and zero warnings;
- direct real replay: success in 4.58 seconds with 25 private contracts,
  mechanics model `0.1.0`, Super Analysis `0.2.0`, seven private temporal
  root-cause candidates and a withheld weekly plan;
- identical direct replay runs produced byte-equivalent analysis JSON hash
  `bf15b99f8bf7dc7d6faf1b20c14fc0d80357e6c6ed150431d8a9f26164fd83c3`;
- authenticated real-replay service smoke: HTTP 202 then HTTP 200, analyzer
  `0.8.0`, zero public findings and explicit `public_output_disabled`;
- graceful SIGINT drained and exited with code 0;
- 2,788/2,788 private review moments materialized from 119 replays, with zero
  missing IDs or replay sources;
- two reviewer packets have identical unique coverage, different order, exact
  handbook binding and zero hidden model fields;
- every private review artifact is permission-restricted to its owner.

This verification intentionally did not run or modify frontend E2E while the
separate frontend task was active.

## Remaining release gates

These are external release operations, not missing engine implementation:

1. build and scan the OCI image from a clean source SHA;
2. deploy the engine to an owner-controlled preview host with private secrets;
3. run the worker release gate in `docs/OPERATIONS.md` against that host;
4. connect the web preview and verify durable retry after a forced restart;
5. keep every formal public detector disabled;
6. later, complete owner-run independent review/adjudication before any
   detector promotion or accuracy claim.

Engine 0.8's deterministic runs, replacement artifacts and scoped local
verification are complete. Remaining release work is external: clean image
build/scan, owner-controlled preview deployment, worker retry/restart exercise
and the later owner-controlled human review before any detector activation or
accuracy claim.
