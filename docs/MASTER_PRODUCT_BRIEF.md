# Replay Method master product brief

Status: active source of truth
Owner: Replay Method
Last consolidated: 18 August 2026

## Why this document exists

The product must not depend on remembering a chat. This brief consolidates the
decisions, research conclusions, design direction and agreed build sequence from
the working sessions. Future work should update this document when a decision
changes rather than allowing the plan to drift or disappear.

Supporting detail remains in:

- [`COMPETITIVE_INTELLIGENCE.md`](COMPETITIVE_INTELLIGENCE.md)
- [`MONETIZATION_STRATEGY.md`](MONETIZATION_STRATEGY.md)
- [`ROCKET_LEAGUE_ENGINE.md`](ROCKET_LEAGUE_ENGINE.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`OPERATIONS.md`](OPERATIONS.md)

## North star

Replay Method is the evidence-based improvement loop for competitive players.
It is not another stats dashboard, generic AI chatbot or library of passive
guides.

The promise is:

> Replay Method finds the repeated decision holding a player back, shows the
> match evidence, gives one concrete rule to train and checks later matches for
> proof that the behavior changed.

The core loop is:

```text
match evidence
  -> broad deterministic analysis
  -> one highest-impact recurring focus
  -> evidence moments
  -> one next-queue rule
  -> deliberate-practice plan
  -> follow-up matches
  -> verified behavioral progress
  -> next focus only when justified
```

The memorable customer-facing form is:

> Replay. Reveal. Practice. Prove.

## What makes the product meaningfully different

No single ingredient is unique. The differentiated product is the combination:

1. **Evidence before language.** Replay telemetry and versioned detectors
   establish facts. AI explains and personalizes those facts; it does not invent
   events, timestamps or causal certainty.
2. **Broad internal coverage, narrow external focus.** The engine examines every
   supported category while the player sees one primary leak, at most two
   supporting observations and one action to carry into the next match.
3. **Action instead of diagnosis alone.** Every public finding needs a queue rule,
   a practice mapping, a success metric and a re-measurement window.
4. **Memory across matches.** A single report is the start. Recurrence, trend and
   active-focus history distinguish a stable weakness from a one-off event.
5. **Proof before rank.** The product measures the targeted behavior before rank
   catches up, so progress is visible and the next focus is earned by evidence.
6. **Honest abstention.** If the available data cannot support a reliable finding,
   the system stops and says why. Confidence is part of the product.

The defensible asset is not the language model. It is the growing body of
versioned replay episodes, calibrated detectors, expert labels, contextual
baselines and measured links between practice prescriptions and later match
behavior.

## Scientific and psychological principles

Product decisions should preserve these mechanisms:

- specific evidence creates trust better than generic advice;
- one priority reduces cognitive overload and increases follow-through;
- deliberate practice needs a clear task, immediate feedback and repetition;
- visible progress reinforces return behavior before delayed rank outcomes;
- a saved baseline and unfinished improvement loop create endowed progress;
- a useful free result removes purchase risk and demonstrates personal value;
- payment should remove limits on cadence, memory and verification, never on
  truthfulness or detector quality;
- accumulating history raises switching cost through genuine usefulness rather
  than artificial lock-in.

These are product hypotheses until measured with real players. The decisive
validation statement is: "It found something concrete I did not see, I could use
the correction and a later report showed whether I improved."

## Market research conclusion

A review of 22 coaching, analytics, replay, training and capture products found
that meaningful free entry is common. At least 18 visibly use a free product,
free analysis, open beta, free utility or substantial free content.

Replay Method therefore does not win merely by being free. It wins by offering:

> a full-quality personal diagnosis free, followed by a paid improvement loop
> that remembers, compares and verifies.

Useful mechanisms to combine include automatic ingestion, contextual baselines,
rank-sensitive analysis, evidence playback, narrow prioritization, mapped
practice, longitudinal trends and optional human review. Patterns to reject
include stat dumping, magic scores, outcome bias, highlight bias, opaque AI,
generic advice, single-match overreaction and unsupported completeness claims.

## Agreed free-to-paid model

### Free

- first complete evidence-backed analysis;
- same detector quality, confidence gates and abstention behavior as paid;
- one primary focus, evidence moments, one queue rule and a focused plan;
- saved private report;
- no card required;
- after account-based limits exist: one focused check-in every rolling 30 days,
  one active focus and a visible reset date.

### Founding 100

- planned price: **$9 per month**;
- first 100 valid founding members;
- price held for the first 12 paid months while continuously subscribed;
- four complete analyses per billing month;
- cross-match recurrence and pattern memory;
- active-focus verification and adaptive next-focus selection;
- priority processing;
- one month of unused-analysis rollover, capped at four;
- cancellation stops future renewal;
- no charge before a separate, explicit checkout.

Do not launch quarterly, six-month or annual commitments during the founding
beta. Review them only after 8–12 weeks of real paid-cohort retention and cost
data. A future public price around $12–$15 is only a hypothesis if the recurring
loop proves valuable. A later annual plan may use a transparent discount.

### Upgrade moments

Show the paid continuation only after value is visible:

1. after evidence and the primary focus have been viewed;
2. when the player chooses to track that focus across new matches;
3. when another replay is submitted before the free reset;
4. when several matches are required to separate recurrence from a one-off.

Primary paid message:

> Keep the coach watching long enough to prove whether the fix worked.

Do not sell "better AI" or place accuracy behind the paywall.

## Guarantee and trust rules

- Do not promise that a player will rank up during beta.
- Do not use deceptive refund fine print or a hidden "grey zone."
- The launch promise is that a supported report shows its evidence, confidence
  and one measurable next action—or states that evidence is insufficient.
- A future progress guarantee may be tested only after longitudinal outcome data
  exists. Eligibility must be visible and objective, with verified accounts,
  baseline/follow-up requirements, practice completion, anti-fraud rules, a clear
  claim window and a real appeal path.
- Marketing, checkout, cancellation, refunds and withdrawal rights must remain
  truthful and compliant in each sales market.

## Website and sales journey

The website should be direct, evidence-led and visually premium. Avoid a giant
redesign for its own sake. Strengthen the conversion journey in this order:

1. **Hero:** "Analyze your first match free" is the single primary action. State
   full diagnosis, private report and no card.
2. **Differentiation:** explain that Replay Method is neither a stats dashboard
   nor an AI chatbot. Its promise is evidence, one priority, one rule and proof.
3. **Product preview:** show Evidence -> One focus -> Proof as a realistic sample
   report, clearly labeled as illustrative.
4. **Method:** Replay -> Reveal -> Practice -> Prove.
5. **Comparison:** contrast stat trackers, generic AI and Replay Method without
   dishonest claims about named competitors.
6. **Free versus Founding:** show exactly what is free now and what the planned
   $9 improvement loop adds. Do not ask for a card before the report.
7. **Post-report offer:** only after the useful diagnosis, offer continued
   tracking, pattern memory and verification. During beta this reserves founding
   access; it does not charge.
8. **Trust:** explain supported inputs, privacy, confidence, limitations and no
   rank guarantee in plain language.
9. **Reduce noise:** shorten duplicated persuasion and keep one dominant action
   per section.

The strongest positioning line is:

> We do not just explain the loss. We help you stop losing for the same reason.

The current owner-supplied commercial hypotheses and their safe implementation
order are preserved in `docs/GROWTH_AND_MONETIZATION_BACKLOG.md`. It includes
landing-page upload, post-value email capture, onboarding, price packaging,
checkout readiness, content channels and paid acquisition. Community promotion
must be transparent; Replay Method will not impersonate independent customers
or manufacture endorsements.

## Rocket League engine direction

Rocket League is the first deep replay adapter. The target is not a single
detector and not the impossible claim of detecting every mistake. It is:

> all measurable, recurring and actionable mistakes supported by the available
> telemetry, with explicit abstention outside that boundary.

The current catalog contains discovery candidates across nine areas:

- boost economy;
- positioning and rotation;
- challenges and decisions;
- recovery and tempo;
- ball control and possession;
- offense and creation;
- defense and risk control;
- kickoffs;
- team coordination.

Catalog inclusion is not public validation. Every detector moves through
`discovery -> candidate -> calibrating -> shadow -> enabled`. Public enablement
requires representative replay fixtures, correct player identity, timestamps
checked against playback, expert labels, rank/mode cohorts, precision and
coverage reports, patch regressions and an abstention rule.

Engine build order:

1. preserve and normalize full frame state;
2. segment touches, possessions, challenges, recoveries, shots, kickoffs and
   concession windows;
3. run a broad detector set in shadow mode;
4. build a replay-moment inspection and labeling surface;
5. calibrate contextual baselines and enable only high-precision findings;
6. rank candidates by recurrence, impact, confidence and trainability;
7. map enabled findings to practice and verify them over later matches.

## Medal and video direction

Medal is inspiration and a possible later integration, not the core dependency.

Near-term options:

- accept a Medal link or uploaded video as supporting evidence;
- synchronize clips with replay timestamps where possible;
- use video for understandable evidence and sharing, while replay telemetry
  decides which moment matters.

Longer-term options:

- an opt-in local companion that watches the Rocket League replay folder and
  uploads completed matches with clear privacy controls;
- automatic evidence clips from important replay moments;
- deeper Medal integration only through documented access or a formal
  partnership.

Avoid highlight bias: spectacular clips are not automatically the most
coach-worthy moments.

## Platform roadmap

### Product foundation already present

- Sites project and custom domain;
- source repository on GitHub;
- protected `main` branch and automated CI;
- complete v16 source import;
- private replay upload and report pipeline foundation;
- versioned report/evidence contracts;
- Rocket League parser service boundary;
- honest blocked/insufficient-evidence states;
- first-report feedback capture;
- competitive and monetization research documents.

### Next product milestone

1. finish and publish the revised evidence-first landing and post-report journey;
2. secure representative legal replay fixtures;
3. expand the completed frame-state and episode extraction regression corpus;
4. calibrate the first small high-precision public detector set while the broad
   catalog runs in shadow mode;
5. add accounts, saved reports, entitlements, usage counters and reset dates;
6. add player-level history and active-focus verification;
7. instrument upgrade intent and cost per successful report;
8. add payment only after the paid benefits genuinely exist;
9. recruit and measure the first founding cohort;
10. expand to Riot games only through approved opt-in access.

## Metrics that decide whether the business works

- successful replay processed and report opened;
- evidence viewed and usefulness rated 4/5 or 5/5;
- click to track the focus or submit a follow-up match;
- free-to-paid conversion after a successful report;
- paid retention at 30, 60 and 90 days;
- targeted behavior improved on supported follow-up matches;
- processing cost and support time per successful report;
- insufficient-evidence and suspected false-positive rates;
- refunds, disputes and cancellation reasons.

Target contribution margin is at least 75–80%. Variable processing, payment and
support costs should be measured per successful report; do not promise unlimited
usage or routine human review before real costs are known.

## Delivery and source-control rules

- Discussion and research must end in either an implementation, a recorded
  decision or an explicitly rejected idea.
- When the owner approves a website change, the normal completion state is:
  implemented, checked, committed, merged through the protected GitHub workflow
  and published to the existing Sites project.
- Do not say a change is live until the deployment is verified.
- Use branches and pull requests; do not bypass protected `main`.
- Keep secrets outside source control. Never place real API keys, tokens,
  passwords or production data in GitHub.
- At meaningful milestones, create a GitHub checkpoint and update this brief.
- A live deployment is not a substitute for a GitHub checkpoint, and a local
  edit is not a completed website change.

## Current implementation checkpoint

At the time of this consolidation:

- the source, CI and branch protection are on GitHub;
- the evidence-first product and multi-detector direction are documented;
- the landing-page monetization and positioning revisions are in the active
  work batch and must be validated, merged and published;
- accounts, enforced free limits, cross-match memory and payments are not yet
  implemented;
- no paid checkout is active;
- the Rocket League catalog is broad, but discovery entries must not be marketed
  as calibrated public detectors;
- Rocket League frame-state and episode extraction now run on real replays;
- eight private shadow probes execute behind explicit public quality gates;
- the first six-replay baseline parsed without failures and produced 515
  anonymized review candidates and 515 matching replay-moment windows;
- a private D1-backed Rocket League review lab now filters those candidates,
  records versioned expert decisions and timestamp checks, preserves an audit
  history, reconstructs each moment in an interactive anonymized viewer, and
  shows raw and conservative detector-level quality metrics;
- the report composer now selects one primary focus only from fully promoted
  findings, adds practice and a three-match success measure, and abstains when
  no detector clears every gate; the initial queue still needs qualified human
  labels and a broader representative corpus before any detector can become
  public;
- League of Legends and VALORANT automated ingestion still depend on approved
  official Riot access.

## Working prompt for future sessions

Use the following instruction when resuming Replay Method work:

> Continue Replay Method from `docs/MASTER_PRODUCT_BRIEF.md`. Treat it as the
> project source of truth. Preserve the evidence-first improvement loop, broad
> internal analysis with one external focus, honest abstention, useful free
> diagnosis and paid longitudinal verification. Inspect the actual repository
> state before acting. Implement the next incomplete milestone, test it, update
> this brief when decisions change, use the protected GitHub workflow and publish
> completed website batches to the existing Sites project. Never claim an idea,
> detector, payment feature or deployment is finished before verification.
