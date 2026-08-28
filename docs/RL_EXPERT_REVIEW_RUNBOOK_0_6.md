# Rocket League 0.6 expert-review runbook

Status: private calibration operation. This does not authorize holdout access,
public activation or customer-facing coaching changes.

## Use only the balanced set

The current label set is
`rocket-league-expert-labels.v7-cohort-balanced-context-0.4`. Do not label any
file without `0.6-balanced` in its artifact path. The earlier 0.6 queue is
preserved only for audit because its context-only sampling overselected 1v1.

Current private artifacts live under the task's `work/grand-calibration`
directory:

- `opportunity-review-queue-0.6-balanced.json`: owner-only master; never give
  this to a reviewer or adjudicator because it contains model decisions.
- `opportunity-review-moments-0.6-balanced.json`: shared anonymized playback
  evidence.
- `blind-reviewer-packets-0.6-balanced/reviewer-a.json`: Reviewer A only.
- `blind-reviewer-packets-0.6-balanced/reviewer-b.json`: Reviewer B only.

The exact label definitions are in `docs/RL_LABEL_HANDBOOK_0_6.md`; SHA-256
  `cceb953aadc3b0040789df757dc282fef35f3319d64d0e102fc07a4e2724b3c8`.

Verify packet hashes before distribution:

```text
Reviewer A  4636d94d066c4f0356da1bc4c77af7c93a4c1963479a6c812124c141667aafad
Reviewer B  f469be3ae97c8baa133e5fa3c4dc8c7da50ec1a4d95df9dc805a719d315d95dd
Moments     bd641fcb9cf5939f978203643b951b1db14dff5e3b844c1de17294c2637c9c23
```

## Reviewer separation

- The two reviewers work independently and never see the master queue, the
  other packet, aggregate results or detector firing/non-firing status.
- Record a stable reviewer identity, concrete Rocket League qualification and
  ISO-8601 submission timestamp in the packet header.
- Each reviewer completes all 1,377 candidates in six rounds of
  230/230/230/229/229/229. A reviewer may stop between rounds; do not split one
  reviewer slot between people.
- Judge the narrow question using the shared handbook. `uncertain` is valid and
  requires a concrete note. Do not infer that a detector name means the model
  fired.
- Every candidate requires `gameplayTruth`, `timestampVerified`,
  `contextCorrect`, `coachingRelevance`, `ambiguous` and `notes`.
- Keep packets private and preserve their source order and candidate metadata.

## Merge and adjudication

After both packets are complete, the owner runs:

```bash
npm run rl-engine:review-merge -- \
  --queue opportunity-review-queue-0.6-balanced.json \
  --submission reviewer-a-complete.json \
  --submission reviewer-b-complete.json \
  --output blind-review-merge-0.6-balanced.json
```

The merge fails closed on model-field leakage, incomplete/non-identical
coverage, duplicate candidates, reused reviewer identity, missing qualification
or timestamp, immutable-field edits and label-manual/provenance drift. It
creates a model-blind adjudication queue for disagreements and
uncertain/ambiguous cases.

A third qualified adjudicator, with an identity distinct from both reviewers,
resolves that redacted queue and records rationale. Then run:

```bash
npm run rl-engine:review-finalize -- \
  --queue opportunity-review-queue-0.6-balanced.json \
  --merge blind-review-merge-0.6-balanced.json \
  --adjudication completed-adjudication-0.6-balanced.json \
  --output final-calibration-0.6-balanced.json
```

The finalizer preserves the two source reviews, validates the exact unresolved
set and only then joins gameplay truth to hidden model decisions. Any case
still uncertain, ambiguous or timestamp-invalid remains visible but excluded
from TP/FP/TN/FN metrics.

## Stop gate

Do not tune thresholds from reviewer identities or open the frozen holdout.
First inspect per-detector and per-mode/rank metrics, disagreement strata,
uncertain rate and Wilson intervals. Freeze and hash every detector version,
threshold, opportunity definition, context schema, label manual and regression
gate before asking the owner for separate holdout authorization.
