# Rocket League detector calibration protocol

Status: private calibration contract. No detector may use this document as an
activation record. Frozen blind holdout access and public activation require
separate owner approval.

## Split and provenance rules

1. `calibration_dev` is the only split permitted for labeling, threshold work,
   error analysis and review-tool debugging.
2. `challenge` and `frozen_blind_holdout` are rejected by the review-queue
   builder. Missing or mixed split metadata is also rejected.
3. Every source replay must be `real_replay`, have a unique replay fingerprint,
   verified subject attribution and no manifest mode mismatch.
4. The calibration report, queue and replay-moment artifacts are hash locked.
   Regeneration creates a new review-set version; it does not silently replace
   the authorized set.
5. A detector version, opportunity definition, context schema or threshold
   change invalidates prior tuning evidence for that exact activation scope.

## Independent review

- Two qualified Rocket League reviewers label the same candidate independently.
- Reviewers do not see detector status, the other reviewer's label, aggregate
  metrics or a detector hypothesis before submitting their first decision.
- Reviewer identity, qualification, playlist/rank scope, label-set version and
  timestamp are required provenance.
- Repeat edits by the same reviewer replace that reviewer's previous decision;
  they do not count as another independent review.
- The independent-review plan and both reviewer packets carry the SHA-256 of
  the exact label handbook. Submissions with different handbook fingerprints
  cannot be merged.

## Label manual

Each candidate receives separate judgments:

1. `timestampVerified`: the displayed moment contains the described source
   event and the subject player is correctly attributed.
2. `gameplayTruth`:
   - `present`: the narrowly defined behavior is visible;
   - `absent`: the narrowly defined behavior is not visible;
   - `uncertain`: telemetry/playback cannot decide it reliably.
3. `contextCorrect`: access, pressure, possession, role/coverage and score/clock
   context shown by the engine matches the replay moment.
4. `coachingRelevance`: whether the behavior, if correct and repeated, is
   trainable and material. This is kept separate from gameplay truth.
5. Reviewers do **not** enter `confirmed` or `rejected`, because that would
   reveal or require knowledge of the model classification. After both blind
   reviews are submitted, the calibration tool joins gameplay truth to the
   hidden model status and derives model agreement for metric calculation.
   `uncertain` remains a reviewer gameplay-truth outcome and is never forced
   into a positive or negative label.

Reviewers must record the concrete confounder when rejecting or marking a case
uncertain: forced action, teammate role, opponent reachability, deliberate
delay, score/time strategy, unavailable alternative, parser/timestamp error or
other specific evidence limitation.

## Adjudication

- Only independently double-reviewed disagreements and uncertain cases enter
  `rocket-league-adjudication-queue.v1`.
- The queue preserves both source labels and starts with `adjudication: null`.
- An adjudicator resolves gameplay truth and records rationale without editing
  either original review.
- Adjudicated cases remain visible in disagreement/error analysis; they are not
  deleted to inflate agreement.

## Blind packet workflow

1. Build the plan with `rl-engine:review-plan`, including `--label-manual`.
2. Export separate packets with `rl-engine:review-packets`. The model decision,
   classification, reasons, observation and evidence are absent.
3. Each reviewer fills their own header (`reviewerId`, `qualification`,
   `submittedAt`) and all six label fields without seeing the other packet.
4. Merge only after both are complete with `rl-engine:review-merge`. The merge
   rejects missing/extra/duplicate candidates, reused identities, immutable
   candidate changes, model fields, incomplete labels, provenance drift and
   different manuals.
5. Only consensus `present`/`absent` cases enter provisional TP/FP/TN/FN
   metrics. Disagreements, uncertainty and ambiguity remain outside those
   metrics until explicit adjudication.
6. The adjudication packet also omits model status. A third, independent
   adjudicator resolves the retained disagreements and records rationale.
   `rl-engine:review-finalize` validates that the original reviewer labels were
   not rewritten before producing final private metrics. Cases still marked
   uncertain, ambiguous or timestamp-invalid remain excluded and visible.

## Metrics

Report per detector version and relevant context/cohort:

- true positives, false positives, true negatives and false negatives;
- precision `TP / (TP + FP)`;
- recall `TP / (TP + FN)`;
- specificity `TN / (TN + FP)`;
- false-positive rate `FP / (FP + TN)`;
- abstention volume and uncertain rate;
- raw independent reviewer agreement and double-reviewed sample count;
- Wilson 95% intervals for binomial rates;
- replay count, opportunity count and unique subject/match coverage.

Never call candidate confirmation rate “precision”. Positive-candidate-only
queues cannot measure recall, specificity or the false-positive rate.

## Threshold freeze and blind holdout gate

Before asking the owner to open the frozen blind holdout, freeze and hash:

- parser, normalizer, frame/event/context and detector versions;
- exact opportunity eligibility and deduplication definition;
- firing, non-firing, ambiguous and abstention rules;
- all numeric thresholds and context strata;
- reviewer manual and adjudication rules;
- activation metrics, minimum samples and regression protocol;
- deterministic source/report/queue fingerprints.

No threshold, context rule or detector logic may change after holdout access. A
change requires a new version and a new untouched holdout; the old result cannot
be retuned into a pass.

## Current blocker

All 0.5 and 0.6 queues are superseded and must not be labeled. The current
0.7 master queue is an owner audit artifact and contains hidden model status.
It covers all 20 measuring contracts with hierarchical round-robin selection
across mode/rank cohort and then context. Rare status classes are exhausted,
not duplicated or synthetically filled.

Reviewers receive separate redacted `rocket-league-blind-reviewer-packet.v1`
files that omit model status, classification, reasons and model evidence. Each
of two packets contains the same 2,276 candidates in a different order and
eight rounds. Both are bound to label handbook SHA-256
`ed56cdcd71243ffc02cce6fd94f18ab217472c29fbda1d0f095758aa76a344ef`.
There is still no complete independent two-reviewer label set; therefore there
are no defensible detector accuracy metrics and no activation candidate.
