# Replay Method: engine market-gap decision

Date: 2026-08-29
Scope: Rocket League engine, calibration, evidence and the customer-facing
contract the engine must support. This document does not authorize public
detectors, holdout access, frontend implementation or market-superiority
claims.

## Decision

Do not add more detectors and do not acquire another generic random corpus
before the first expert review.

The next product advantage will not come from moving from 60 to 100 detector
names or from competing with 100,000–640,000-replay marketing claims. It comes
from proving that a narrow, recurring behavior is real, attaching inspectable
evidence, prescribing one usable correction and measuring the same behavior
again in comparable future matches.

The immediate sequence is:

1. restore/reacquire source replays and regenerate review media as v3;
2. run the bounded 487-case first review across all 60 measuring lanes;
3. revise, retain or retire lanes from human evidence;
4. deepen coaching and practice mappings only for lanes that survive;
5. collect a separate longitudinal repeated-player corpus;
6. validate the version-locked improvement loop on comparable baseline and
   follow-up matches;
7. keep unsupported claims private or explicitly inconclusive.

## Binding product vision

Replay Method must feel like **ElevenLabs for Rocket League replay analysis**:
heavy technical capability behind a calm, immediate and self-explanatory
surface. The useful analogy is an iPhone rather than a feature-dense Android
interface: the engine can be complex, but the customer should not need to learn
the system before receiving value.

The product is not allowed to become minimalist but empty. Premium perception
must come from precision, responsiveness, visual restraint and the feeling that
the product already understands the next useful step.

The required customer loop is:

```text
Replay -> Reveal -> Practice -> Prove
```

The engine contract behind that simple loop is:

```text
replay-visible observation
  -> context and opportunity denominator
  -> recurring comparable behavior
  -> reviewed primary focus
  -> exact evidence moments
  -> one if-then rule
  -> one short practice prescription
  -> version-compatible remeasurement
  -> improved / regressed / resolved / inconclusive
```

The customer should never be forced to navigate 60 detectors, confidence
plumbing, raw tables or calibration terminology. Those remain available only
through progressive disclosure when they create trust.

### Marcel UX/funnel principles

Every customer state must be evaluated against the existing Marcel review
dimensions:

- comprehension within seconds;
- minimum necessary decisions and clicks;
- immediate, legible feedback;
- one red thread from entry to next action;
- removal of avoidable friction;
- product/app feeling rather than brochure feeling;
- high-octane simplicity without stimulation overload.

One dominant action is visible at a time. Advanced detail follows the result;
it does not compete with the result.

### Audience, community and commercial model

The primary audience is younger Rocket League players, including Gen Z. The
product should feel culturally credible and worth showing to a friend without
imitating youth slang or using generic neon gaming decoration.

Community is earned through useful, shareable proof and visible progress, not
manufactured streaks or spam. Private replay evidence must remain private by
default; any share artifact needs explicit customer action and truthful scope.

The recurring subscription value is not "better accuracy for paying users."
It is continued memory, comparison, cadence and proof:

- the first useful diagnosis proves personal value;
- the paid loop remembers the active focus;
- later comparable matches test whether it changed;
- the next focus appears only when evidence supports the transition.

This is the retention mechanism that can create recurring revenue and finance a
later SaaS. If players do not return to measure change, the commercial thesis is
not validated regardless of visual quality.

## Current market map

Public capabilities were rechecked against first-party pages on 2026-08-29.
Marketing claims below are vendor claims unless independently stated.

| Product | Publicly presented strength | Consequence for Replay Method |
| --- | --- | --- |
| [DataCoach](https://www.datacoach.gg/esports/rocket-league) | Automatic upload, 640,000+ replay library, progress tracking, plain-language chat, custom plans, Bronze–SSL and 1v1/2v2/3v3 coverage | Generic multi-match patterns, plans, chat and progress tracking are not unique |
| [Replay Bench](https://www.replaybench.com/features) | 100,000+ rank-stratified corpus, per-frame/per-touch Threat, whole-field alternatives, 3D viewer and deterministic coaching notes | "Why" analysis, alternatives and rank-aware notes are already claimed |
| [ReplayLabs](https://replaylabs.app/features) | Grades, event timeline, baseline delta, mistake distribution, replay groups and recurring focus areas | Recurring mistakes and grouped trends are table stakes |
| [trophi.ai](https://trophiai.atlassian.net/wiki/spaces/RL2/pages/901480449/Rocket+League+FAQ) | Background replay ingestion, last-game/last-10 trends, overlays, guided training paths and pro-comparison drills | Low-friction ingestion and connected training already exist |
| [RL Coach](https://rlcoach.org/) | Browser upload, grade, notes, seven-day plan, map/pack codes, mechanics and car-control claims | A generic AI plan or mechanics report is not a moat |
| [Pi Replays](https://pireplays.co.uk/) | Rank-aware coaching, drills, boost heatmaps, pitch view and pro clip pairing | Drill recommendations and visual evidence are already sold |
| [NextTouch](https://nexttouch.gg/) | 3D replay viewer, multiple cameras, timestamped AI tips and category scores | A polished viewer plus category scoring is insufficient differentiation |
| [CARL2](https://lndrlndr.github.io/) | Local processing, multi-replay aggregation, trends, lifetime history and synchronized replay control | Local privacy, comparisons and history are established features |
| [ballchasing](https://ballchasing.com/) | Large searchable replay platform, detailed replay statistics and viewing | Replay Method should interpret and prioritize rather than recreate a stat warehouse |

DataCoach's rank-up percentages are observational figures from its own accounts.
They show an association between replay use and rank change; they do not prove
that its product caused the improvement.

## What is not a defensible market claim

Replay Method cannot honestly differentiate itself with any one of these:

- "AI replay analysis";
- lots of statistics or heatmaps;
- a match grade;
- timestamped mistakes;
- a seven-day plan;
- mechanics analysis;
- rank-aware advice;
- multi-match patterns;
- progress tracking;
- a 3D viewer;
- a large unreviewed replay count;
- confident natural-language explanations.

Competitors publicly present all of them.

## The specific market gap

The reviewed public pages did not document this complete combination:

1. a versioned detector identifies a replay-visible behavior only inside its
   supported context;
2. every firing is evaluated against the complete opportunity denominator,
   including non-firings and abstentions;
3. reviewed evidence moments support one recurring focus rather than a list of
   everything that happened;
4. one if-then rule and one bounded practice intervention follow;
5. later matches are filtered to comparable mode, rank, context and detector
   version;
6. the product states improved, regressed, resolved or inconclusive from that
   like-for-like evidence;
7. uncertainty and abstention are visible rather than replaced by confident AI
   prose.

This is evidence of an underserved positioning, not proof that no competitor
has private or unreleased work in the same direction. Public copy must not say
"only product" or "most accurate" without an external benchmark.

The concise positioning is:

> Replay Method does not grade everything you did. It finds the one repeated
> behavior measurably holding you back, shows the moments, gives you one rule
> and proves in later comparable matches whether it changed.

## Actual engine position

The current engine has 60 private measuring opportunity contracts across nine
categories. All remain shadow/private. The 1,000-replay master corpus contains:

- 700 `calibration_dev` replays analyzed twice with identical deterministic
  fingerprints;
- 150 untouched challenge replays;
- 150 untouched frozen holdout replays;
- 1,300,510 opportunity decisions in the two-run evidence package;
- 7,017 review candidates across 665 development replays;
- complete candidate moments for all 60 detectors.

Two lanes have scarce positive engine firings in the development queue:

- `challenge.fake_opportunity`: 5;
- `rotation.backboard_uncovered`: 11.

All 60 lanes measure. That is not the same as 60 validated coaching products.
Only a minority currently have mature prescription and deep mechanics mappings.
Expanding those mappings before review would spend time on lanes that may need
revision or retirement.

## Pre-review structural work completed

The previous 7,017-case packet was too large for an eight-hour first pass and
was bound to an older label-manual fingerprint. It must not be used.

The corrected private Day 1 selection contains 487 cases:

- at least eight stratified cases per detector;
- all 5 `challenge.fake_opportunity` firings;
- all 11 `rotation.backboard_uncovered` firings plus controls;
- no challenge or frozen-holdout data;
- identical coverage for reviewer A and reviewer B;
- model decision and rationale removed;
- detector id, detector version and replay fingerprint removed from the live
  reviewer API presentation;
- the complete 0.8 base and 0.9 extension manuals bound as one ordered SHA-256
  artifact;
- fail-closed startup when the presented manual does not match the packet.

At roughly 59 seconds per case, 487 cases fill eight hours. Actual time may vary;
the tool autosaves and can resume without losing completed decisions.

### Remaining evidence-media blocker

The retained 487 anonymized moments were originally generated at 5 Hz and do
not include car rotation. That is enough to inspect some broad spatial states,
but it is not enough to honestly judge every fast touch, landing orientation,
kickoff execution or mechanics lane. The original replay files and private
source manifest are not present in the current private workspace, so higher
rate evidence cannot be reconstructed from these compact moments.

The moment builder and reviewer have now been upgraded for a v3 evidence
artifact with 10 Hz full-context playback, car rotation and retained 30 Hz
detail around supported decision events. The all-60 reviewer fails closed on
the old v2/5 Hz artifact. Therefore the current 487 selection is structurally
preserved but must not be labeled yet.

The next operational step is either:

1. restore the exact source replay files and manifest from a private backup and
   regenerate the 487 moments as v3; or
2. acquire a new source-preserved calibration-development review corpus, rerun
   the 60 private detectors and generate a new bounded v3 packet.

A new Ballchasing token must be rotated and supplied through a local environment
variable rather than pasted into a command. The previously pasted token should
be treated as exposed.

## Build decision around the first review

### Do before the review

- Restore or reacquire source replays and regenerate v3 evidence media.
- Use only a packet that passes the all-60 v3 presentation gate.
- Verify the reviewer can understand the narrow question and controls on a
  short, unscored orientation pass.
- Keep all public outputs, challenge, frozen holdout and customer coaching
  closed.

No additional detector logic or threshold tuning should occur between packet
freeze and completed labels. Changing the engine mid-review invalidates the
binding.

### Do immediately after the review

For each detector, calculate reviewed precision, false-positive behavior,
false negatives, uncertainty, timestamp correctness, context correctness and
coaching relevance. Then classify the lane:

- retain for deeper validation;
- revise and create a new version;
- keep private for research;
- retire.

Build full explanations, practice mappings and weekly-plan support only for the
retained high-value lanes. The product should prefer ten excellent coaching
lanes over sixty weak public ones while the private catalog continues to grow.

### The next 1,000 replays

The current master corpus deliberately avoids repeated player identities. That
protects splits, but it cannot validate the core paid promise: change in the
same player over time.

If another 1,000 replays are acquired, they should form a separate longitudinal
development corpus, not another random rank/season sample. It needs stable,
privacy-controlled subject identity, multiple sessions per subject, dates,
mode/rank context and enough pre/post exposure for the same behavior. A useful
shape is approximately 40–50 participants with 20–25 replays each rather than
1,000 unrelated players.

This corpus must remain separate from challenge and frozen holdout. It validates
Pattern Memory and the Verified Improvement Loop; it does not replace expert
labels for detector truth.

## Technical truth boundary

Replay-visible kinematics can support deep analysis of position, rotation,
velocity, boost, contacts, landing alignment, recovery paths, control windows,
spacing and tactical coverage.

Replay files do not justify claims about exact controller input, camera input,
communications, intent or a medical/motor impairment. The official
[Rocket League Stats API](https://www.rocketleague.com/developer/stats-api)
supports local state/events and replay load, seek, speed, pause and POV control.
It is useful for a future opt-in desktop companion and exact evidence playback;
it does not turn every hidden intention into observable truth.

## Funnel and retention acceptance tests

The combined engine/product thesis is validated only when real target users can:

- understand the input and promised output within five seconds;
- complete the core replay-to-result path without instruction;
- recall the one rule after leaving the report;
- inspect why the engine chose it without reading a dashboard;
- apply the correction in play;
- return voluntarily to test the same focus;
- understand an inconclusive result without losing trust;
- perceive the product as premium and worth paying for;
- want to share or discuss the experience without being prompted;
- convert and retain because continued measurement is useful.

The engine metric and commercial metric must be reported separately. A precise
detector with poor retention is not yet a business. Strong conversion around
weak detector truth is not an acceptable product.

## Bottom line

Replay Method should not be the tool with the most visible analysis. It should
be the cleanest route from a technically deep replay observation to a behavior
the player can understand, train and prove they changed.

The immediate unknown is detector truth. The bounded 487-case structure is
correct, but its evidence media must be regenerated before the review starts.
The strategic build after review is not more random breadth. It is validated
coaching depth plus a longitudinal proof loop, delivered through an
ElevenLabs/iPhone level of simplicity and the Marcel funnel discipline.
