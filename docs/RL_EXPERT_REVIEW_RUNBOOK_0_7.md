# Rocket League 0.7 expert-review runbook

Status: private calibration operation. This does not authorize threshold
changes, holdout access, public activation or customer-facing coaching changes.

## Use only the all-contracts set

The current label set is
`rocket-league-expert-labels.v8-all-contracts-context-0.5`. Do not label any
0.5 or 0.6 artifact; those sets are preserved only for audit.

Do not distribute the earlier `0.7-balanced-all-contracts` queue or packets.
They carried a handwritten `subtr-actor@1.2.2` provenance label while the
locked parser was `1.2.0`. The replacement candidate payload is exactly
identical, but only the `0.7-parser-truth` queue and packets are bound to the
corrected reproducibility fingerprint.

Current private artifacts live under the task's `work/grand-calibration`
directory:

- `opportunity-review-queue-0.7-parser-truth.json`: owner-only
  master; never give it to a reviewer or adjudicator because it contains model
  decisions.
- `opportunity-review-moments-0.7-balanced-all-contracts.json`: shared,
  anonymized playback evidence.
- `blind-reviewer-packets-0.7-parser-truth/reviewer-a.json`:
  Reviewer A only.
- `blind-reviewer-packets-0.7-parser-truth/reviewer-b.json`:
  Reviewer B only.

The exact definitions are in `docs/RL_LABEL_HANDBOOK_0_7.md`; SHA-256
`ed56cdcd71243ffc02cce6fd94f18ab217472c29fbda1d0f095758aa76a344ef`.

Verify hashes before distribution:

```text
Master queue  43de8148bbd36516f5937480d1bc6ace67604401300c745d2ab1d39de191585d
Moments       fd725505d7f27ba0a5dec125aca620f2f715b636d1806112633ec32faa098a50
Review plan   a1c09b97825a83aabe6f2993d211b87333e2c734e69cf6d50287b90f0cdac426
Reviewer A    ea1a44919d0010110c7c50e9edd43048dd1214b6f9842207ae34f07cb6dc5a03
Reviewer B    aaa29a00303fefe3c96798040d97f8c6c2ca6688ef901320a7edb0991a631732
```

## Reviewer separation

- Reviewers work independently and never see the master queue, the other
  packet, aggregate results or detector firing/non-firing status.
- Record a stable reviewer identity, concrete Rocket League qualification and
  ISO-8601 submission timestamp in each packet header.
- Each reviewer completes all 2,276 candidates in eight rounds of
  285/285/285/285/284/284/284/284. Do not split one reviewer slot between
  people.
- Judge the narrow question using the 0.7 handbook. `uncertain` is valid and
  requires a concrete note. Do not infer a model decision from a detector name.
- Every candidate requires `gameplayTruth`, `timestampVerified`,
  `contextCorrect`, `coachingRelevance`, `ambiguous` and `notes`.
- Preserve packet ordering and immutable candidate metadata. Keep all artifacts
  private.

## Local blind-review tool

Run one localhost-only session per reviewer. The tool reads only that
reviewer's redacted packet, the anonymized moments and the handbook; it never
opens the master queue. It renders a top-down playback, enforces complete label
fields and writes progress atomically to a separate file.

```bash
node scripts/start-rl-blind-review.mjs \
  --packet blind-reviewer-packets-0.7-parser-truth/reviewer-a.json \
  --moments opportunity-review-moments-0.7-balanced-all-contracts.json \
  --handbook /absolute/repository/path/docs/RL_LABEL_HANDBOOK_0_7.md \
  --output reviewer-a-complete.json \
  --port 5177
```

Use another local port and the Reviewer B packet/output for the second person.
The server binds only to `127.0.0.1`. Do not place the session behind a public
tunnel. A prior partial output is resumable only when its immutable packet
fingerprint matches the source assignment. Finalization is rejected until all
2,276 decisions and reviewer provenance are complete.

## Merge and adjudication

After both packets are complete, run from the private artifact directory:

```bash
npm run rl-engine:review-merge -- \
  --queue opportunity-review-queue-0.7-parser-truth.json \
  --submission reviewer-a-complete.json \
  --submission reviewer-b-complete.json \
  --output blind-review-merge-0.7-balanced-all-contracts.json
```

The merge fails closed on model-field leakage, incomplete/non-identical
coverage, duplicate candidates, reused identity, missing qualification or
timestamp, immutable-field edits and handbook/provenance drift. It creates a
model-blind adjudication queue for disagreements and uncertain/ambiguous cases.

A third qualified adjudicator, distinct from both reviewers, resolves that
redacted queue and records rationale. Then run:

```bash
npm run rl-engine:review-finalize -- \
  --queue opportunity-review-queue-0.7-parser-truth.json \
  --merge blind-review-merge-0.7-balanced-all-contracts.json \
  --adjudication completed-adjudication-0.7-balanced-all-contracts.json \
  --output final-calibration-0.7-balanced-all-contracts.json
```

The finalizer preserves the two source reviews, validates the exact unresolved
set and only then joins gameplay truth to hidden model decisions. Any case
still uncertain, ambiguous or timestamp-invalid remains visible and excluded
from TP/FP/TN/FN metrics.

## Stop gate

Do not tune thresholds from reviewer identities or open the frozen holdout.
First inspect per-detector and per-mode/rank metrics, disagreement strata,
uncertain rate and Wilson intervals. Freeze and hash every detector version,
threshold, opportunity definition, context schema, label manual and regression
gate before asking the owner for separate holdout authorization.
