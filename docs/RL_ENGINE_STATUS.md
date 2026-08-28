# Rocket League master engine status

Last verified: 2026-08-28

## Engine Foundation 0.11 / engine 0.8 local work in progress

Engine 0.8 adds a versioned `rocket-league-mechanics-model@0.1.0`. It derives
touch and recovery episodes from replay-visible position, rotation, linear and
angular velocity, boost, ball distance and parser events. Whole-match state
remains 10 Hz; mechanics episodes use only the already bounded 30 Hz detail
pool. The model explicitly does not infer controller input, camera view,
communications, intent, fatigue or motor impairment.

Five former capability-abstention lanes now have complete private opportunity
contracts: `recovery.landing_orientation`, `recovery.post_aerial_exit`,
`recovery.wall_to_ground`, `possession.control_space` and
`possession.wall_control`. The fixed catalog remains 60 lanes: 25 measuring and
35 capability-abstaining. Analyzer, detector bundle and shadow runtime are
`0.8.0`; normalizer is `0.7.0`; decision context is `0.6.0`; mechanics is
`0.1.0`; decision metadata is `0.7.0`; Super Analysis is `0.2.0`. All public
gates remain closed.

Super Analysis keeps private technical evidence separate from customer
coaching. It records the observation, kinematic mechanism, causal boundary,
correction hypothesis and exact remeasurement metrics. `primaryFocus` and the
three-session weekly plan remain null/withheld until the exact detector has an
eligible quality gate. The handoff schema is documented in
`docs/RL_ENGINE_FRONTEND_CONTRACT_0_8.md`; no customer React or CSS was changed.

Super Analysis also groups temporally adjacent private findings into bounded
root-cause candidates, but labels every edge as sequence rather than causation.
A separate `rocket-league-mechanics-signature@0.1.0` aggregator measures
within-player kinematic medians and dispersion across version-compatible
replays. It refuses mixed mechanics-model versions and does not emit a skill
grade, diagnosis, rank benchmark or improvement claim. A separate
`rocket-league-mechanics-signature-comparison@0.1.0` now compares compatible
baseline/follow-up medians and dispersion. It keeps
`improvementClaimEligible: false` until a calibrated focus supplies a validated
metric direction and comparable-context gate.

Two independent full `calibration_dev` executions parsed 120/120
manifest-hash-verified real replays with zero failures, mode mismatches,
attribution failures, duplicate opportunities or contract-integrity failures.
Both produced fingerprint
`dd9a3fb39619f7101a0a09b5241253c2ecde7e2f6b3fbe085403488fe661e1a3`
and full canonical opportunity-outcome hash
`7a32f17000769fb5709f625201562f2d49ef17c7b500aa80fb56e7768a9771a7`.
Across 2,880 applicable replay-contract runs, engine 0.8 evaluated 83,557
opportunities: 7,823 firing, 50,715 non-firing and 25,019 abstained. These are
engine decisions, not expert correctness rates.

| New private contract | Firing | Non-firing | Abstained | Total |
| --- | ---: | ---: | ---: | ---: |
| `possession.control_space` | 47 | 565 | 4,474 | 5,086 |
| `possession.wall_control` | 23 | 142 | 437 | 602 |
| `recovery.landing_orientation` | 38 | 2,293 | 3,528 | 5,859 |
| `recovery.post_aerial_exit` | 10 | 3,208 | 959 | 4,177 |
| `recovery.wall_to_ground` | 1 | 935 | 538 | 1,474 |

Run A/B total runtime was 581.2/581.5 seconds, mean replay runtime was
4.844/4.846 seconds, p95 was 8.680/8.627 seconds and maximum post-replay RSS
observed was 846,397,440/861,224,960 bytes. RSS is a post-replay sample inside
one long-lived process, not a per-request peak.

The replacement blind queue uses
`rocket-league-expert-labels.v9-mechanics-context-0.6` and covers all 25
measuring contracts. It contains 2,788 unique candidates from 119 replays: 830
firing, 1,000 non-firing and 958 abstained. Mode coverage is 754 1v1, 1,163
2v2 and 871 3v3; rank-cohort coverage is 1,013 gold–platinum, 1,044
diamond–champion and 731 grand-champion–SSL. Rare firing states are represented
only as often as they exist: 38 landing-orientation, 10 post-aerial-exit and one
wall-to-ground candidate. No example was duplicated or fabricated.

All 2,788 anonymized eight-second moment windows were materialized from 119
manifest-selected `calibration_dev` replays with zero missing IDs or source
replays. Two permission-restricted, model-blind reviewer packets cover the same
2,788 candidates in different orders and 12 resume-safe rounds of 232–233.
They contain zero model-status, classification, reason, evidence or outcome
fields. The full owner review therefore requires 5,576 independent decisions
before separate adjudication.

Final scoped verification passed 107/107 engine tests, 19/19 engine/web
contract and production-boundary tests and engine/calibration lint with zero
warnings. A real Ranked Doubles replay completed both directly and through the
authenticated asynchronous service. Two direct runs produced byte-equivalent
analysis JSON; the service returned HTTP 202 then 200, zero public findings and
explicit `public_output_disabled`. Graceful SIGINT exited with code 0.

No current-version expert labels exist, the frozen holdout remains untouched,
and no detector, coaching policy, customer frontend or deployment was changed.

## Engine Foundation 0.10 / engine 0.7 local checkpoint

Engine 0.7 closes the last positive-candidate-only measurement gap. All 20
measuring lanes now expose a versioned opportunity contract with firing,
non-firing and explicit abstained decisions against one integrity-checked
denominator. The catalog remains 60 lanes: 20 measured opportunity contracts
and 40 explicit capability abstentions. No capability-only lane is represented
as measured `no_signal`.

The eight promoted contract lanes are `boost.zero_duration`,
`boost.supersonic_waste`, `kickoff.speed`, `possession.first_touch`,
`challenge.dive`, `rotation.spacing_too_close`, `teamplay.double_commit` and
`recovery.momentum_loss`. They use complete zero-reserve episodes, complete
boost-press episodes, kickoff jobs, attributable first-touch/challenge events,
shared teammate geometry and landing/re-entry opportunities. Their versions
are private hypotheses, not accuracy claims.

Analyzer, detector bundle and shadow runtime are `0.7.0`; decision context is
`0.5.0`; tactical spatial is `0.2.0`; opportunity contract and Pattern Memory
remain `0.2.0`; batch aggregation remains `1.3.0`. The first-touch lane is now
narrower than first-touch retention: it targets a hard low/medium-pressure
touch that concedes next control, while softer unresolved alternatives and
high-pressure relief abstain.

Two independent 120-replay `calibration_dev` runs reproduced fingerprint
`158a156c540e606f59abe91fdefc856ab4fdec2cc358165272769042d3674afa`.
Each parsed 120/120 real replays with zero failures, mode mismatches, duplicate
opportunities or integrity failures. Across 2,280 applicable replay-contract
runs, the engine evaluated 66,359 opportunities: 7,704 firing, 43,572
non-firing and 15,083 abstained. The apparent proportions are engine outputs,
not expert correctness rates.

The 2026-08-28 rerun corrected a provenance-only defect: engine 0.7 had
handwritten `subtr-actor@1.2.2` while the locked and executed dependency was
`1.2.0`. Parser version now resolves from the installed package metadata. A
separate outcome hash over every opportunity ID, status, classification,
context, reason and evidence remained
`79c290df461044b5a6c26ef047842870455555bc98f70474b61e4977dfd4424d`
across the old run and both corrected runs, so no gameplay decision or
threshold changed.

| Private contract | Firing | Non-firing | Abstained | Total |
| --- | ---: | ---: | ---: | ---: |
| `boost.defensive_reserve` | 518 | 1,164 | 1,473 | 3,155 |
| `boost.overfill` | 670 | 8,145 | 406 | 9,221 |
| `boost.supersonic_waste` | 1,208 | 11,524 | 2,814 | 15,546 |
| `boost.zero_duration` | 1,457 | 186 | 1,050 | 2,693 |
| `challenge.dive` | 41 | 1,520 | 433 | 1,994 |
| `challenge.last_player` | 110 | 1,248 | 62 | 1,420 |
| `challenge.quality` | 89 | 1,175 | 730 | 1,994 |
| `challenge.teammate_coverage` | 121 | 1,265 | 34 | 1,420 |
| `defense.clear_direction` | 436 | 470 | 255 | 1,161 |
| `kickoff.contact` | 224 | 210 | 29 | 463 |
| `kickoff.speed` | 13 | 401 | 49 | 463 |
| `offense.center_to_opponent` | 73 | 228 | 63 | 364 |
| `possession.first_touch` | 570 | 1,104 | 1,846 | 3,520 |
| `possession.first_touch_retention` | 1,085 | 1,104 | 1,331 | 3,520 |
| `possession.giveaway` | 529 | 2,010 | 2,547 | 5,086 |
| `recovery.momentum_loss` | 6 | 1,053 | 126 | 1,185 |
| `recovery.reentry_quality` | 23 | 1,053 | 109 | 1,185 |
| `rotation.spacing_too_close` | 118 | 3,636 | 1,086 | 4,840 |
| `rotation.third_overextension` | 37 | 2,235 | 17 | 2,289 |
| `teamplay.double_commit` | 376 | 3,841 | 623 | 4,840 |

Long-lived-process runtime was 575.4 seconds in corrected run A and 574.0
seconds in run B. Mean replay time was 4.80/4.78 seconds, p50 was 4.38/4.41
seconds and p95 was 8.68/8.66 seconds. Maximum post-replay RSS observed was
810,369,024 and 818,954,240 bytes; this is not a per-request peak-memory
measurement.

The current private review set is
`rocket-league-expert-labels.v8-all-contracts-context-0.5`. Its master queue
contains 2,276 unique candidates from 119 replays and all 20 contracts: 718
firing, 800 non-firing and 758 abstained. It contains 602 1v1, 961 2v2 and 713
3v3 moments; rank coverage is 827 gold–platinum, 844 diamond–champion and 605
grand-champion–SSL. Status shortfalls reflect every available rare event;
examples were not duplicated or fabricated.

All 2,276 anonymized moment windows were materialized with zero missing IDs.
Two redacted packets each contain the exact same candidates in independent
orders and eight rounds of 285/285/285/285/284/284/284/284. Packets contain
zero model-status, classification or model-outcome fields. The full review
therefore requires 4,552 independent decisions before adjudication.

No current-version expert labels exist, the frozen holdout remains untouched,
and no detector, coaching policy, frontend behavior or deployment was changed.
The next irreducible gate is independent human review followed by separate
adjudication; metrics cannot be honestly manufactured in code.

## Engine Foundation 0.9 / engine 0.6 local checkpoint

Engine 0.6 fixes a material unit bug before expert review: replay frame boost is
stored in raw 0–255 units, while the 0.5 shadow probes treated it as 0–100.
Frame state v2 now retains `boostRaw` for compatibility and exposes explicit
`boostPercent`. Supersonic waste and boost overfill consume normalized percent
units. `boost.supersonic_waste` and `boost.overfill` are therefore version
`0.3.0`; the unlabeled 0.5 review package is superseded and must not be labeled.

A shared tactical-spatial primitive now provides a clearly named kinematic
intercept proxy, access margin, first/support/safety role, defensive layer,
goal-side state, lane overlap and field zone. It is a deterministic comparison
proxy, not a full physics simulation. Decision context is `0.4.0` and
`challenge.quality` is `0.3.0` because last-layer classification now uses the
defensive layer instead of access order.

Four additional private detectors now have real opportunity contracts:
`boost.defensive_reserve`, `rotation.third_overextension`,
`challenge.teammate_coverage` and `challenge.last_player`. The catalog remains
60 lanes: 20 measuring, 12 with complete opportunity denominators, eight
positive-episode-only and 40 capability-abstaining.

Two final 120-replay `calibration_dev` runs produced the identical fingerprint
`fd37fa588d773782d8f05cc58f096bb34a2f12d4286705abbfc0ee449a82824b`,
with zero failures, duplicate opportunities or contract-integrity failures.
The 12 contracts contain 31,278 evaluations. An initial 1,377-candidate review
queue was rejected before labeling because context-only sampling overselected
1v1 (867 candidates) and nearly erased 3v3 (34). The replacement sampler is
hierarchical: round-robin across mode/rank cohorts, then opportunity contexts,
with the existing per-replay cap. The current blind package contains 1,377
candidates and 1,377 anonymized moments from 119 replays, with zero
missing or extra IDs. Two independent reviewers must each label all 1,377
candidates, for 2,754 decisions before adjudication.

Current review coverage is 361 1v1, 600 2v2 and 416 3v3 candidates; rank
coverage is 502 gold–platinum, 517 diamond–champion and 358
grand-champion–SSL. This is sampling balance, not detector accuracy.

Review leakage is now closed at the artifact boundary. Separate reviewer
packets omit model status, classification, reasons, observations and evidence;
the plan binds both packets to the exact label-handbook SHA-256. A fail-closed
private merge validates complete identical coverage, distinct reviewer
identities, qualification/timestamp provenance and immutable candidate fields,
then derives consensus TP/FP/TN/FN outcomes against the hidden master queue.
Disagreements and uncertain/ambiguous cases remain isolated in a second
model-blind packet. A separate finalizer requires an independent adjudicator,
preserves both source labels and excludes any still-unresolved cases from final
metrics.

No current-version expert labels exist, the holdout remains untouched, and no
detector or coaching policy is public.

## Engine Foundation 0.8 / engine 0.5 local checkpoint

The current local engine makes the calibration boundary explicit without
changing public coaching output. Analyzer, detector bundle and shadow runtime
are `0.5.0`; decision context is `0.3.0`, opportunity contracts are `0.2.0`,
Pattern Memory is `0.2.0`, and batch aggregation is `1.3.0`.

Capability-only lanes no longer emit an empty opportunity contract that can be
misread as measured `no_signal`. They return `capability_abstained`. Eight
measuring detectors now use real opportunity contracts with unique opportunity
IDs, firing/non-firing/abstained denominators and integrity checks. The other
eight measuring detectors remain positive-episode telemetry and cannot yet
measure false negatives. The remaining 44 catalog lanes are capability-only.

Decision context is chronological and versioned across match phase, live play,
mode, access order and basis, possession, pressure, coverage, score state and
clock state. Pattern identities now freeze detector, opportunity-contract and
context versions as well as thresholds, preventing comparisons across changed
behavior definitions. Calibration and moment-building tools select manifest
paths before reading replay bytes, verify hashes, reject protected splits and
fail closed on duplicate or attribution-invalid inputs.

Two independent `calibration_dev` runs completed on 120/120 real replays with
no parser failure, mode mismatch, attribution failure, duplicate replay or
opportunity-integrity failure. They produced the same deterministic
fingerprint, `0c42fde51f4907b272211f1153e99c91abbae397cfb3931374a258fd40d85c8e`.
The corpus contained 430,563 sampled frames, 729,863 parser events and 141,187
decision events. Runtime measured in one long-lived process was 569.1 seconds
total, 4.74 seconds mean, 4.36 seconds p50 and 8.53 seconds p95 per replay;
maximum observed post-replay RSS was 799,047,680 bytes and is not a per-request
peak measurement.

The eight opportunity detectors produced 22,994 private evaluations:

| Detector | Firing | Non-firing | Abstained | Total |
| --- | ---: | ---: | ---: | ---: |
| Boost overfill | 1,082 | 7,785 | 354 | 9,221 |
| Challenge quality | 89 | 1,175 | 730 | 1,994 |
| Defensive clear direction | 436 | 470 | 255 | 1,161 |
| Kickoff contact | 224 | 210 | 29 | 463 |
| Center to opponent | 73 | 228 | 63 | 364 |
| First-touch retention | 1,085 | 1,104 | 1,331 | 3,520 |
| Possession giveaway | 529 | 2,010 | 2,547 | 5,086 |
| Recovery/re-entry quality | 23 | 1,053 | 109 | 1,185 |

A new private, non-activated `rocket-league-opportunity-review-queue.v1`
checkpoint contains 932 blind candidates from 96 `calibration_dev` replays:
303 firing, 320 non-firing and 309 abstained. All 932 anonymized review moments
were materialized with zero missing or extra candidate IDs. Two independent
reviewer assignments cover all 932 candidates in different deterministic
orders, requiring 1,864 decisions before adjudication. This set is not wired to
the existing review UI and does not replace the previously authorized active
import.

No expert labels exist for the current detector/context versions. Precision,
recall, specificity, false-positive rate, agreement and calibration confidence
intervals therefore remain unavailable. No holdout was opened, no detector was
activated and no customer-visible policy changed.

## Previous Engine Foundation 0.7 local revision

The current local engine adds a private decision-intelligence lane without
changing public coaching output. The stable whole-match state remains 10 Hz.
A second 30 Hz parse is retained only as a deduplicated frame pool around at
most 96 subject-linked decision events, with small event-to-frame references.

Every decision-context detector uses an opportunity contract. The contract
records every eligible opportunity, firing, non-firing and abstention against
the same versioned context denominator. Ten-match aggregation persists these
private comparable-opportunity patterns, but they do not select or alter the
customer's primary finding.

Batch aggregation now adds a private, versioned Pattern Lock contract for the
strongest comparable context per detector. It separates insufficient exposure,
isolated signals, emerging patterns, high-abstention ambiguity and distributed
cross-match recurrence. A stable contract ID freezes detector version, context
and thresholds so a later ten-match window can be compared against the same
behavior definition. The comparison can return a private improvement,
regression, resolution or inconclusive signal; it never establishes detector
correctness, causation or public coaching eligibility.

Five additional measuring shadow probes are now present:

- boost-pad overfill with efficient, material and borderline outcomes;
- kickoff contact with immediate team-leverage attribution;
- low-pressure possession giveaways across all attributable touches;
- centered balls where the opponent earns the first follow-up;
- defensive clears that are immediately recycled by the opponent.

They run alongside the previous eleven measuring probes. All 60 catalog entries
now have a versioned executable lane across the nine analysis areas. Sixteen
currently measure replay telemetry; the remaining 44 return a named capability
abstention until their counterfactual or role models are evidence-complete.
None of the new five has an Early Access policy, expert labels, activation
record or public status. Analyzer, shadow runtime and detector bundle versions
are `0.4.0`; batch aggregation is `1.2.0` and Pattern Memory is `0.1.0`.

The customer report can now present the complete nine-area analysis map without
exposing an unvalidated coaching claim. It shows all 60 checks, the 16 data-backed
lanes and the protected abstentions separately. This is customer-visible engine
coverage, not blanket detector promotion.

### Private opportunity-review foundation

The local `calibration_dev` split has now been processed through the complete
opportunity contracts without opening the challenge or frozen blind holdout
splits. All 120/120 replays parsed successfully with verified attribution and
no mode mismatch. The run contains 19,912 reviewable detector evaluations:

| Detector | Firing | Non-firing | Abstained | Total |
| --- | ---: | ---: | ---: | ---: |
| First-touch retention | 3,513 | 5,023 | 4,926 | 13,462 |
| Challenge quality | 212 | 2,153 | 2,900 | 5,265 |
| Recovery/re-entry quality | 23 | 1,053 | 109 | 1,185 |

A separate `rocket-league-opportunity-review-queue.v1` artifact samples each
status independently across contexts with a per-replay cap. It contains 343
blind, unlabeled candidates from 85 replays and 343 matching anonymized moment
windows. Recovery has only 23 firing evaluations in the dev split, so the queue
preserves the real shortfall instead of manufacturing a 40-case target.

Two independent full runs produced the same reproducibility fingerprint,
`9a468554eb76498d04de36203542a30fb0cb741f16b54f5687ba1d3a04d4a75c`,
with identical corpus and opportunity-status counts and no version drift.

This new artifact is private and owner-readable only. It is now the locally
authorized review set, transported as exact hash-locked gzip files with the
canonical JSON hashes verified after decompression. The historical queue is
preserved but no longer the active import target. The complete local owner
import and blind-review journey passes end to end; its ephemeral test judgment
is not expert evidence. No real expert labels exist yet, and no detector
lifecycle or customer-facing output has changed.

The reviewer surface divides the locked set deterministically into two balanced
passes without changing either authorized artifact: pass 1 contains 172 moments
and pass 2 contains 171. Assignment is stable by detector, opportunity status,
context and candidate key. Pass 1 is an operational calibration checkpoint, not
a substitute for the full independent-label gate; the frozen blind holdout must
remain unopened until the complete calibration rule is locked.

## Historical checked-in calibration revision

The checked-in shadow-runtime revision groups adjacent 10 Hz
`boost.supersonic_waste` samples into one continuous reviewable decision. This
prevents a single boost press from creating several near-identical expert-review
candidates. The detector is versioned as `0.2.0`; the historical runtime and
aggregate detector bundle were also versioned `0.2.0`.

The six-replay baseline, 515-candidate review queue and 515 private review
moments were regenerated from the authorized local corpus on 2026-08-20. Two
independent runs produced the same reproducibility fingerprint:
`8ca92b978c6296bd4d7be63a64dd4ca36042e7842e3e0fc8d3698445f36c5e3a`.
The grouping reduced raw supersonic-waste observations from 816 to 257 without
changing the bounded review-queue size. No candidate has an expert label or
verified timestamp yet. The revision does not make the detector public and
does not reduce any quality gate.

## What works now

The engine can safely validate and parse a modern Rocket League `.replay`,
attribute the requested player, and build three evidence layers:

1. a 10 Hz named frame-state for the ball and every player;
2. a match-phase and decision-event timeline;
3. versioned private shadow-detector observations.

The frame-state preserves position, rotation, linear and angular velocity,
boost, distance to ball, match time and seconds remaining. The timeline
preserves parser-backed phases and events without calling them mistakes.

Sixty detector lanes now execute in shadow mode. Sixteen measure replay data:

- extended zero-boost exposure;
- boost waste while already supersonic;
- kickoff timing and contact measurements;
- first-touch outcomes;
- dive/whiff candidates;
- prolonged teammate-spacing overlap;
- likely same-ball double commitments;
- recovery momentum loss away from the play;
- first-touch retention with explicit non-firing outcomes;
- challenge quality with access and coverage context;
- post-landing useful re-entry timing.
- boost-pad overfill;
- kickoff-contact leverage;
- general low-pressure possession giveaways;
- center follow-up ownership;
- defensive-clear follow-up ownership.

The other 44 lanes perform a versioned capability check and abstain explicitly
when the required model is not ready. Shadow mode is deliberately private.
These probes create calibration candidates or protected abstentions, not
customer-facing coaching findings.

## Checked-in historical real-replay baseline

The checked-in review artifacts were produced from six distinct real replays
and remain the locked input to the existing 515-candidate label interface:

| Measure | Result |
| --- | ---: |
| Parsed replays | 6 / 6 |
| Environments | 3 modern 2v2, 3 legacy compatibility fixtures |
| Sampled frame-states | 22,992 |
| Raw parser events | 52,971 |
| Decision events | 9,722 |
| Shadow detector executions | 48 |
| Detector execution errors | 0 |
| Raw shadow candidates | 739 |
| Review candidates exported | 515 |
| Replay moments generated | 515 / 515 |
| Publicly enabled detectors | 0 |

Generated evidence:

- `docs/RL_ENGINE_BASELINE.json` contains the reproducible corpus run;
- `docs/RL_REVIEW_QUEUE.json` contains anonymized timestamp candidates for
  expert review.
- `docs/RL_REVIEW_MOMENTS.json` contains anonymized, time-windowed 3D state for
  every review candidate without original player names or platform IDs.
- `/admin/rl-review` imports those candidates into D1, provides private
  detector/replay/verdict filters, and writes every owner decision to the
  versioned `rocket-league-expert-labels.v1` audit history. Each candidate now
  has an interactive top-down moment viewer with playback, scrubbing, speed
  controls, trails and movement vectors so a reviewer can verify the timestamp
  without exposing the original identity.

## Quality gate

A detector cannot become public merely because it returns data. The current
gate requires at least:

- 50 representative replays;
- 30 reviewed positive and 30 reviewed negative examples;
- at least 90% precision;
- at least 85% Wilson lower confidence bound, preventing a tiny perfect sample
  from appearing production-ready;
- no more than 5% false positives;
- 95% timestamp verification;
- three rank/mode cohorts;
- expert-label, patch-regression and abstention tests.

All 60 lanes remain public-ineligible. The sixteen measuring probes have no
passing activation record, and the five-detector `0.4.0` expansion is not part
of the locked `0.3.0` review queue. The separate local Season 21 closeout contains 200 unique original
replays with a 120/40/40 dev/challenge/holdout split and 200/200 parser success,
but no independent expert labels. It proves compatibility, coverage and
reproducibility, not detector correctness.

The gate also requires independent reviewers, reviewer agreement, complete
label provenance, minimum samples within each cohort, detector dependency and
conflict tests, confidence-calibration evidence, exact-run reproducibility and
version/patch regression. Synthetic fixtures exercise software only and are
excluded from calibration replay counts.

## Coaching output

The private engine now includes a deterministic report composer. It ranks only
findings whose detector version has passed every public gate, selects one
primary focus, limits supporting observations to two, and attaches a queue
rule, practice plan, success metric and three-match verification window. If no
finding passes, it returns `insufficient_evidence`; language generation cannot
upgrade a shadow observation into a public claim.

The decision policy validates the exact detector activation record, supported
mode, sample floor and dependencies before scoring. It resolves duplicate and
conflicting findings deterministically, preserves an active focus or regression
where evidence supports it, and records suppressed alternatives. Prescriptions
include dosage, an exclusion cue, return-to-play rule, later success evidence
and intervention-failure evidence.

Detector lifecycle is explicit (`discovery` → `candidate` → `calibrating` →
`shadow` → `enabled`, with `demoted` rollback). Activation records bind
version, scope, quality gate, provenance and a reproducible fingerprint. D1 has additive audit
storage for reviewer qualification, cohort/provenance, quality snapshots,
lifecycle events and later non-firing detector evaluations.

## Next engine milestone

1. preserve the locked `0.3.0` three-detector queue and produce a separate,
   version-pinned review queue for the five new `0.4.0` opportunity detectors;
2. use the private review interface to confirm timestamps and independent
   expert labels;
3. calculate precision and false-positive reports per detector version and
   opportunity context;
4. run patch-regression and abstention tests over the labeled corpus;
5. promote only passing detectors from `shadow` to `enabled`;
6. persist a signed-off quality snapshot and activation event;
7. verify the same behavior over later comparable opportunities.

The website should not advertise automatic Rocket League coaching as ready
until at least one detector clears this process and the replay-engine service
is deployed with its required private credentials.

## Deployment-readiness boundary

The native service is packaged and hardened for a later deployment: it has
separate liveness/readiness endpoints, bounded request metadata and replay
size, bearer authentication, a configurable concurrency ceiling, safe logs,
graceful shutdown, and a container health check. The web client validates an
HTTPS engine URL, enforces a bounded timeout, distinguishes auth/contract
failures from transient capacity/network failures, and persists a real due
time for automatic retries.

Service `rl-engine.v1.1` also counts accepted asynchronous jobs against the
same concurrency limit, releases failed job IDs after their result is observed
so durable retries can resubmit, and reports its configured job/shutdown
deadlines in readiness. Its service-owned lock installs only
`@rlrml/subtr-actor@1.2.0`; parser provenance is resolved from that installed
package rather than a handwritten version string. The final local build,
218-test repository suite and lint pass on 2026-08-28. See
`docs/RL_ENGINE_PRODUCTION_READINESS_2026-08-28.md` for exact runtime evidence
and remaining external preview gates.

Independent fail-closed switches gate worker calls, public detector output and
background retries. Deploying the process cannot itself activate a detector.

This is source readiness, not a deployed service. `RL_ENGINE_URL` and the
shared `RL_ENGINE_TOKEN` still require an owner-controlled engine environment.
The 200-replay Season 21 corpus remains private and unlabeled, and all public
detectors remain `QUALITY GATE NOT YET MET`.

## Reproducing the baseline

```bash
npm run rl-engine:calibrate -- /path/to/replay-corpus --output docs/RL_ENGINE_BASELINE.json
npm run rl-engine:review-queue -- docs/RL_ENGINE_BASELINE.json docs/RL_REVIEW_QUEUE.json
npm run rl-engine:review-moments -- /path/to/replay-corpus --queue docs/RL_REVIEW_QUEUE.json --output docs/RL_REVIEW_MOMENTS.json
```

Replay files are calibration inputs and must not be committed unless their
license and player privacy have been explicitly cleared.
