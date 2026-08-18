# Rocket League master engine status

Last verified: 2026-08-18

## What works now

The engine can safely validate and parse a modern Rocket League `.replay`,
attribute the requested player, and build three evidence layers:

1. a 10 Hz named frame-state for the ball and every player;
2. a match-phase and decision-event timeline;
3. versioned private shadow-detector observations.

The frame-state preserves position, rotation, linear and angular velocity,
boost, distance to ball, match time and seconds remaining. The timeline
preserves parser-backed phases and events without calling them mistakes.

Eight probes now run in shadow mode:

- extended zero-boost exposure;
- boost waste while already supersonic;
- kickoff timing and contact measurements;
- first-touch outcomes;
- dive/whiff candidates;
- prolonged teammate-spacing overlap;
- likely same-ball double commitments;
- recovery momentum loss away from the play.

Shadow mode is deliberately private. These probes create calibration
candidates, not customer-facing coaching findings.

## Real-replay baseline

The checked-in baseline was produced from six distinct real replays:

| Measure | Result |
| --- | ---: |
| Parsed replays | 6 / 6 |
| Environments | 3 Ranked Doubles, 3 LAN |
| Sampled frame-states | 22,992 |
| Raw parser events | 52,971 |
| Decision events | 9,722 |
| Shadow detector executions | 48 |
| Detector execution errors | 0 |
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

The eight probes currently fail this gate because the corpus is small and the
review queue is unlabeled. That is expected and prevents fake confidence.

## Coaching output

The private engine now includes a deterministic report composer. It ranks only
findings whose detector version has passed every public gate, selects one
primary focus, limits supporting observations to two, and attaches a queue
rule, practice plan, success metric and three-match verification window. If no
finding passes, it returns `insufficient_evidence`; language generation cannot
upgrade a shadow observation into a public claim.

## Next engine milestone

1. use the private review interface to confirm timestamps and labels;
2. obtain representative 1v1, 2v2 and 3v3 replays across rank cohorts;
3. calculate precision and false-positive reports per detector version;
4. run patch-regression and abstention tests over the labeled corpus;
5. promote only passing detectors from `shadow` to `enabled`;
6. rank enabled findings by recurrence, impact, confidence and trainability;
7. verify the same behavior over later matches.

The website should not advertise automatic Rocket League coaching as ready
until at least one detector clears this process and the replay-engine service
is deployed with its required private credentials.

## Reproducing the baseline

```bash
npm run rl-engine:calibrate -- /path/to/replay-corpus --output docs/RL_ENGINE_BASELINE.json
npm run rl-engine:review-queue -- docs/RL_ENGINE_BASELINE.json docs/RL_REVIEW_QUEUE.json
npm run rl-engine:review-moments -- /path/to/replay-corpus --queue docs/RL_REVIEW_QUEUE.json --output docs/RL_REVIEW_MOMENTS.json
```

Replay files are calibration inputs and must not be committed unless their
license and player privacy have been explicitly cleared.
