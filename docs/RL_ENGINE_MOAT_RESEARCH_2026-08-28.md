# Rocket League engine moat research

Research snapshot: 2026-08-28

Scope: engine, calibration, evidence contracts and engine-to-frontend handoff.
This document does not authorize a customer UI change, detector activation,
publication, deployment or use of the frozen holdout.

## Decision

The next product moat should be a **Verified Improvement Loop**, not another AI
report, grade, heatmap or generic training plan.

Replay Method should remember a player's version-locked mechanics and decision
signatures, select one evidence-backed focus, prescribe a short testable
intervention, and remeasure the same contexts in later replays. The result must
separate:

1. what the replay directly shows;
2. what the engine hypothesizes technically;
3. what changed in a comparable follow-up sample;
4. what is still unknown.

This is the best near-term combination of customer value, technical
differentiation and honest proof. A counterfactual simulator is the strongest
long-term R&D option, but it must not become a customer claim before replay-to-
simulation divergence and action uncertainty have been quantified.

## What the public market already offers

The reviewed public product material already covers most obvious feature-list
ideas:

| Publicly advertised category | Current examples |
| --- | --- |
| AI notes, mechanics guides and short plans | [RL Coach](https://rlcoach.org/) advertises grades, AI notes, seven-day plans, training-pack codes, mechanic breakdowns, car control and pro comparisons. |
| Automated ingestion, voice and guided training | [trophi.ai](https://trophiai.atlassian.net/wiki/spaces/RL2/pages/901480449/Rocket%2BLeague%2BFAQ) advertises automatic replay saving/upload, post-match analysis, overlays, voice coaching and structured training paths. |
| Recurring problems and group trends | [ReplayLabs](https://replaylabs.app/features) advertises grades, mistake timelines, baseline deltas, replay groups, heatmaps and recurring focus areas. |
| Whole-field value and frame-linked coaching | [Replay Bench](https://www.replaybench.com/features) advertises per-touch whole-field Threat, rank-stratified coaching, a 3D viewer and deterministic frame-linked notes. |

Therefore these are table stakes, not a defensible moat by themselves. The
reviewed public pages did not document Replay Method's proposed combination of
version-locked mechanics distributions, detector-level abstention, exact
remeasurement contracts and a claim boundary between observation, temporal
hypothesis and verified change. That is a research observation about published
materials, not proof that no private competitor has similar technology.

## Data truth: what a replay can and cannot prove

### Safe now

Replay-visible state supports versioned measurement of position, rotation,
linear/angular velocity, boost state, touches, jumps/dodges and derived
kinematic episodes. It can support descriptive questions such as:

- Was the car upright and aligned after landing?
- How long until useful speed or stable heading returned?
- How did the car approach the ball and what changed after contact?
- Did close control remain available in the retained post-touch window?
- Does the same player show a repeatable distribution over several replays?

### Must remain bounded

Replay files do not provide a perfect ground-truth stream of every controller
input. RLGym's replay tooling can produce action arrays, but its own ecosystem
uses reconstruction for missing aerial controls. Rocket League replay research
also describes replays as lossy, inconsistently sampled reconstructions and
reports imperfect action estimation. See [RLGym Tools](https://rlgym.org/RLGym%20Tools/introduction/),
[RLGym action parsers](https://rlgym.org/Rocket%20League/Configuration%20Objects/action_parsers/),
[replay-pretraining](https://github.com/Rolv-Arild/replay-pretraining) and the
[ICLR 2026 Rocket League data appendix](https://openreview.net/pdf?id=IieErAsrna).

Consequences:

- Do not claim exact joystick technique, camera usage, intent, reaction time,
  fatigue or motor impairment from a replay alone.
- Do not describe an inferred input sequence as recorded fact.
- Do not call a different simulated continuation "what would have happened."
- Keep causal language behind intervention and repeated-comparison evidence.

### Optional companion data

Rocket League's official [Game Data Stats API](https://www.rocketleague.com/developer/stats-api)
can emit local match/replay events at a configured rate up to 120 updates per
second and can load, seek, pause, change speed and change POV in replays. Its
documented update payload exposes scoreboard and spectator state such as speed,
boost, boosting, ground/wall and powerslide status; it is not a documented
complete controller-input API.

This makes a future desktop companion useful for automatic ingestion and
one-click evidence playback. It does not remove the replay input-truth limit and
is not required for the engine's next proof layer.

## Ranked opportunities

Scores are 1-5. Evidence safety is higher when the feature can be defended with
current replay truth. Cost and calibration burden are higher when harder.

| Candidate | Customer value | Differentiation | Evidence safety | Build cost | Calibration burden | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Verified Improvement Loop | 5 | 5 | 5 | 3 | 4 | Build next |
| Mechanics Repeatability Signature | 4 | 5 | 5 | 2 | 3 | Core of next phase; private 0.1 exists |
| Evidence-linked Mistake Chain | 5 | 4 | 3 | 3 | 5 | Keep as temporal hypothesis until reviewed |
| Contextual rank benchmark | 4 | 3 | 3 | 4 | 5 | Later, after a larger rank-clean corpus |
| Feasible Alternative Simulator | 5 | 5 | 2 | 5 | 5 | Research spike only |
| Desktop auto-ingest and replay seek | 4 | 3 | 5 | 4 | 2 | Later product/companion project |
| Generic AI report, grade or heatmap | 3 | 1 | 2 | 2 | 4 | Do not make this the moat |
| Exact input or motor diagnosis from replay | 3 | 3 | 1 | 5 | 5 | Reject without new direct data |

## Exact next build sequence

### M1. Finish engine 0.8 evidence package

- Preserve both deterministic 120-replay `calibration_dev` runs.
- Produce a fresh blind queue and anonymized moment package for all 25 measuring
  contracts and the mechanics-context label set.
- Keep the frozen holdout unopened and all public gates closed.
- Run complete engine regression, service smoke, deterministic output comparison
  and memory/load checks.

Exit condition: every engine artifact is version-bound, internally consistent,
has zero missing review moments and can be reproduced without reading a
protected split.

### M2. Build the private Verified Improvement Loop contract

For a baseline window and a follow-up window, require:

- same subject identity policy;
- same detector, context, mechanics-model and signature versions;
- minimum replay and episode exposure on both sides;
- like-for-like mode/rank/context filtering;
- median and dispersion deltas with uncertainty/status;
- no "improved" label when metric direction is not validated;
- no customer focus or plan unless the source detector quality gate is eligible.

The first output should be deliberately narrow: one focus, the exact replay
evidence, one technical correction hypothesis, three short sessions and the
metrics that will be measured again. The frontend task only receives the
documented contract; it owns presentation.

### M3. Owner-controlled expert evidence

Two independent reviewers label the exact same model-blind candidates. A third
independent adjudicator resolves disagreements and uncertainty. Only then can
precision, recall, specificity, false-positive rate, reviewer agreement and
customer coaching eligibility be computed honestly.

This is an activation gate, not an engine-development blocker: M2 and the
simulator research harness can be completed privately before the owner performs
the final review.

### M4. Feasible Alternative Simulator research

[RocketSim](https://github.com/ZealanL/RocketSim) is MIT-licensed and designed
for fast Rocket League-like physics. Its maintainer explicitly states that it
is not perfectly accurate and that small errors accumulate, although it is
useful for shot/input optimization and air control. The repository also warns
against uses that violate Rocket League terms and against building a playable
clone.

Before any product integration:

1. initialize simulator snapshots from replay states;
2. replay short observed continuations with reconstructed actions;
3. measure position, rotation, velocity, touch and outcome divergence at
   0.25/0.5/1/2 seconds across modes and surfaces;
4. attach uncertainty from input reconstruction and simulator divergence;
5. enumerate only bounded action macros around reviewed decision moments;
6. output a set of feasible alternatives, never one asserted counterfactual;
7. obtain commercial legal review before shipping the dependency or derived
   arena assets.

Exit condition: predefined divergence and calibration thresholds pass on a
separate development corpus. Until then the feature remains private R&D.

### M5. Optional desktop companion

After the engine proof layer is stable, a separate product task can use the
official local Stats API for automatic replay discovery and exact timestamp
playback. It must be opt-in, local-first, authenticated at the Replay Method
boundary and scoped so it cannot send arbitrary game commands.

## Product claim boundary

Allowed before expert activation:

- "Measured from replay-visible movement"
- "Private hypothesis"
- "Repeated in X comparable episodes"
- "Changed between version-compatible samples"
- "The engine abstained because evidence was insufficient"

Not allowed before the corresponding evidence exists:

- "Expert-calibrated"
- "This caused the goal"
- "These were your exact controller inputs"
- "This alternative would have scored"
- "You improved" when only a direction-ambiguous kinematic metric changed
- "Best/most accurate on the market" without a named external benchmark

## Bottom line

The market gap is not more output. It is **proof of improvement without fake
certainty**. Replay Method should become the engine that can say exactly what it
saw, why a reviewed pattern matters, what to test next, whether the same pattern
changed, and when it still does not know.
