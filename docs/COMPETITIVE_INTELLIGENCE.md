# Coaching product deep dive

## Purpose and method

This document translates a review of 22 coaching, analytics, replay, training and
video products into product and engine decisions for Replay Method. The review
uses public first-party product pages, documentation and engineering write-ups
available in August 2026. It is a capability review, not a claim that every
listed product is profitable or that its marketing claims have been independently
verified.

The useful question is not "which competitor should we copy?" It is:

> Which repeated product mechanisms reduce friction, produce trustworthy insight,
> prescribe useful practice and make improvement visible?

We reuse patterns and public ideas, not proprietary code, private data, wording,
ratings or model outputs.

## Product matrix

| Product | Primary input | Strong mechanism | Limitation or risk | Replay Method lesson |
| --- | --- | --- | --- | --- |
| [Trophi.ai](https://trophiai.atlassian.net/wiki/spaces/RL2/pages/901480449/Rocket+League+FAQ) | Automatically saved Rocket League replays | Background ingestion, last-game/last-10 trends, playstyle and boost overlays, guided skill paths | Desktop/overlay dependency and platform-policy changes | Make replay collection nearly invisible; connect every diagnosis to a measurable lesson |
| [ballchasing.com](https://ballchasing.com/doc/_api) | Uploaded Rocket League replay | Deep, transparent boost, movement, positioning and team statistics plus replay viewing | Rich dashboards still leave interpretation to the player | Treat its public metric vocabulary as coverage inspiration, then add prioritization and action |
| [calculated.gg / carball](https://github.com/SaltieRL/carball) | Rocket League replay | Reproducible frame data and structured JSON/dataframe analysis at scale | Infrastructure and metrics, not a complete behavior-change loop | Keep parsing and coaching separate; make normalized data reprocessable |
| [Rocket League Tracker](https://tracker.gg/rocket-league/app) | Account plus desktop overlay | MMR history, recent performance, live scouting and lightweight progress views | Mostly outcome and summary statistics; PC-only richer capture | Rank progression is motivation, but cannot substitute for replay evidence |
| [ReplayLabs](https://replaylabs.app/) | Rocket League replay | Grade, mistakes and next fix in one review; community feedback loop | Public evidence about detector validity and calibration is limited | A short result is commercially clear, but every grade must expose evidence and confidence |
| [Replay Bench](https://www.replaybench.com/) | Rocket League replay | Per-frame threat, possession-level analysis, viewer and rank-stratified advice | Threat is powerful but cannot represent every kind of mistake alone | Evaluate decisions against the alternatives available at that exact frame, not only outcomes |
| [RL Coach](https://rlcoach.app/) | Replay or video clip | Pairs analysis with concrete training pack/workshop recommendations | Video can miss hidden world state; public validation detail is limited | End every supported finding with an executable drill and success measure |
| [Mobalytics](https://mobalytics.gg/gpi) | Riot match/account data | Broad skill model decomposed into role-sensitive subskills and a prioritized focus | Composite scores can become opaque or feel arbitrary | Use a broad internal skill graph; make weights and evidence explainable |
| [Blitz](https://blitz.gg/welcome/lol) | Desktop app plus match data | Auto-import, in-game goals and immediate post-match evaluation | Convenience features can overshadow actual learning; overlay rules can change | Win on low friction, but keep the durable value in post-match learning |
| [Porofessor](https://porofessor.gg/en/download) | Riot data plus overlay | Fast player tags, matchup context, detailed farming/fighting/vision/objective charts | Many facts and tags can overload the player | Compress a large analysis into one focus, while retaining drill-down evidence |
| [OP.GG](https://op.gg/desktop/en) | Multi-game accounts plus desktop app | Excellent discovery, current builds, real-time overlays and huge habitual utility | Optimizes immediate decisions more than transferable player skill | Separate "help me now" utilities from the core improvement product |
| [U.GG](https://u.gg/faq/) | Riot API population data | Granular filters by role, rank, region, patch and matchup; clear sample sizes | Population-optimal choices are not the same as personal coaching | Baselines must be mode/rank/role/patch aware and state their sample source |
| [iTero](https://www.itero.gg/articles/how-can-ai-help-me-improve-at-gaming) | Many matches from one League account | Learns recurring macro patterns, estimates win impact and prioritizes improvement areas | Correlation can be presented as causation; needs large, fresh data | Prefer repeated behavioral patterns over one-match blame; distinguish association from causal claim |
| [Valorant Tracker](https://tracker.gg/valorant) | Riot account plus desktop overlay | Timeline history, map/agent/weapon cuts, last-20 trends and smart clips | Weighted scores can hide tradeoffs; capture is PC dependent | Join longitudinal metrics to the exact rounds and clips that explain them |
| [Leetify](https://leetify.com/blog/cs2-benchmarks/) | CS demo/match data | Aim, utility and positioning ratings benchmarked with calibrated population distributions | Benchmarks drift as games and players change | Version, date and continuously recalibrate every benchmark |
| [SCOPE.GG](https://scope.gg/) | Steam/FACEIT matches and demos | Mistake summaries, map zones, aim/utility metrics, clips, replay viewer and 30-match progress | Breadth risks becoming another dashboard | Combine telemetry, evidence playback and progress, but rank the coaching queue |
| [Refrag](https://wiki.refrag.gg/) | Match history plus purpose-built training servers | Analysis generates a custom routine; realistic isolated training and exams close the loop | Requires a large training-content and server operation | Detection without a deliberate-practice destination is incomplete |
| [Aimlabs](https://aimlabs.com/) | Purpose-built aim assessments and training | Personalized tasks, immediate feedback, daily programs and high repetition | Transfer from isolated aim tasks to match decisions is not automatic | Measure the practice itself and verify transfer in later matches |
| [Medal](https://medal.tv/auto-clipping) | Always-on video buffer plus game events | Automatic event clips, near-zero capture friction, instant sharing and social identity | Highlight bias favors exciting successes, not subtle recurring mistakes | Use clips as evidence and retention, while replay telemetry chooses the important moment |
| [Insights.gg](https://landing-page.sys.insights.gg/) | Video capture/upload | Timestamped annotations, drawing, comments and collaborative review | Manual review does not scale to every player or every match | Let AI preselect evidence; preserve human/coach annotation as a premium feedback layer |
| [Metafy](https://help.metafy.gg/en/articles/11535324-how-to-book-a-session) | Live play, screen share or replay/VOD | Trust through a chosen expert, dialogue and tailored 1:1 review | Expensive and hard to scale consistently | Provide an escalation path where a human can inspect the same structured evidence |
| [Skill Capped](https://www.skill-capped.com/) | Structured curriculum and VOD review | Role-specific courses, expert access and an outcome-oriented rank guarantee | Content libraries can become passive consumption | Prescribe the smallest relevant lesson and require observable application, not just viewing |

## What repeatedly works

### 1. Automatic ingestion wins before analysis begins

Trophi, Medal, Tracker, Scope and desktop League assistants reduce the distance
between finishing a match and seeing value. Manual upload can remain as a fallback,
but the durable product should offer an opt-in local uploader that watches the
replay folder, encrypts/uploads after the match and clearly exposes privacy controls.

### 2. Broad internal models, narrow external focus

Mobalytics, Leetify, Scope and iTero all organize many signals into skill areas.
The useful pattern is a broad internal scorecard, not a broad wall of advice.
Replay Method should analyze every supported category and surface:

1. one primary leak;
2. up to two supporting observations;
3. the evidence moments;
4. one queue rule;
5. one short practice prescription.

### 3. Contextual baselines beat universal thresholds

Rank, mode, role, patch, map and playstyle change what "good" means. U.GG's
filters, Leetify's rank comparisons, Replay Bench's rank stratification and
Mobalytics' role weighting all point to contextual baselines. Every Replay Method
metric should record its baseline cohort, sample size, collection window and
version.

### 4. Recurrence is more coachable than a single mistake

iTero's most valuable idea is searching many matches for behaviors that repeatedly
reduce win probability. A single match can generate observations; a player-level
focus should normally require recurrence across a session or history window.

### 5. Evidence needs a playback surface

Scope, Insights, Medal, ballchasing and Replay Bench make an abstract metric
inspectable. Replay Method needs a timeline with timestamps first, then a viewer
or synchronized video. A user should be able to answer "where did you see that?"
in one click.

### 6. Diagnosis must terminate in deliberate practice

Refrag, Aimlabs, Trophi and Skill Capped close the gap between knowing and doing.
Each detector therefore needs a practice mapping, a queue rule, a success metric
and a re-measurement window. Generic tips are not a valid detector output.

### 7. Progress is the retention loop

Last-10/20/30-match trends, MMR curves, streaks and skill paths create a reason to
return. Replay Method should measure whether the current focus is improving,
stable or regressing, and only change focus when the evidence supports it.

### 8. AI is strongest after deterministic evidence

The technically credible pattern is telemetry or replay extraction first, then
classification/ranking, then natural-language explanation. A conversational
coach can improve accessibility and motivation, but it must not invent events,
timestamps, alternatives or causal certainty.

## What repeatedly fails or creates risk

- **Stat dumping:** dozens of charts with no decision about what to fix.
- **One magic score:** a composite number without component evidence or stable calibration.
- **Outcome bias:** labeling a decision bad only because a goal followed it.
- **Highlight bias:** showing spectacular clips while ignoring positioning and recovery leaks.
- **Generic advice:** recommendations that would be identical for every player.
- **Single-match overreaction:** changing a player's focus because of one unusual game.
- **Opaque AI authority:** confident prose with no reproducible detector output.
- **Desktop friction:** heavy overlays, anti-cheat anxiety, resource use and PC-only support.
- **Policy dependency:** live overlays and undocumented client access can disappear after publisher rule changes.
- **Stale benchmarks:** patches and player behavior invalidate old thresholds.
- **Training without transfer:** a drill score improves but the match behavior does not.
- **False completeness:** claiming to detect every mistake despite missing intent, comms or hidden context.

## Replay Method product thesis

Replay Method should not attempt to be another stats site, overlay bundle or chat
wrapper. Its defensible loop is:

```text
private replay ingestion
  -> full-match state timeline
  -> situation and possession segmentation
  -> broad versioned detector registry
  -> contextual baseline and counterfactual comparison
  -> evidence-backed finding candidates
  -> recurrence and estimated-impact ranking
  -> one primary player focus
  -> exact replay moments + optional synchronized video
  -> queue rule + deliberate-practice task
  -> measurement over the next matches
```

The honest target is not "all mistakes." It is **all measurable, recurring and
actionable mistakes supported by the available telemetry**, with explicit
abstention outside that boundary.

## Engine implications

### Required data layers

1. **Frame state:** ball and every car's position, velocity, rotation, boost,
   team, demolition state and contact state.
2. **Derived geometry:** goal-side status, distances, lanes, field zones,
   intercept estimates, reachable space and teammate coverage.
3. **Episodes:** possessions, challenges, touches, shots, saves, clears,
   recoveries, boost routes, kickoffs, transitions and concession windows.
4. **Finding candidates:** timestamped detector observations with counter-evidence.
5. **Player history:** comparable metrics, cohorts, current focus and response to practice.

### Detector contract

Every detector must declare:

- category and skill;
- supported modes and telemetry dependencies;
- observation window and exclusions;
- evidence and counter-evidence;
- confidence calculation;
- severity/impact model;
- cohort baseline version;
- practice mapping and success metric;
- calibration state and detector version.

### Quality gates

A detector moves from `discovery` to `candidate`, `calibrating`, `shadow`, and
finally `enabled`. Enabling requires representative replays, expert labels,
timestamp verification, mode/rank stratification, precision and coverage reports,
patch regression tests and an agreed abstention rule. Recall can grow later;
unsupported confident advice is the launch-killing failure.

## Prioritized build sequence

### Phase A — state and episode foundation

- Preserve frame data instead of discarding the parsed ndarray.
- Normalize players, ball, boost and timestamps into a stable internal schema.
- Segment touches, possessions, challenges, recoveries, shots and goal windows.
- Build a timestamp/evidence inspection tool for calibration.

### Phase B — broad shadow-mode detector set

- Implement high-observability candidates across boost, rotation, challenges,
  recovery, possession, offense and defense.
- Run all candidates in shadow mode on the calibration corpus.
- Store every observation, disagreement and abstention without showing coaching.

### Phase C — calibration and ranking

- Add expert labels and replay-moment review.
- Create mode/rank cohorts and versioned baselines.
- Enable only high-precision detectors.
- Rank by recurrence, estimated opportunity cost, confidence and trainability.

### Phase D — improvement loop

- Map findings to queue rules, training packs and measurable tasks.
- Track the same behavior over the next 5–10 matches.
- Add optional Medal/video evidence and coach collaboration after replay-native
  evidence is reliable.

## Strategic moat

The moat is not the language model. It is the growing set of versioned replay
episodes, expert labels, contextual baselines, calibrated detector outputs and
measured links between prescribed practice and later match behavior. That asset
compounds while the explanation layer can use whichever language model is best.
