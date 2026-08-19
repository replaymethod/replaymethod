# Replay Method Codex routing and safety

Read this file first. Perform only the task explicitly requested in the current
turn, and read only the documentation relevant to that task. Do not
automatically read the full `docs/MASTER_PRODUCT_BRIEF.md` for every task.

## Documentation routing

- Product direction, positioning, pricing or roadmap:
  `docs/MASTER_PRODUCT_BRIEF.md`; use
  `docs/GROWTH_AND_MONETIZATION_BACKLOG.md` and
  `docs/MONETIZATION_STRATEGY.md` only when relevant, and
  `docs/COMPETITIVE_INTELLIGENCE.md` only when research is explicitly required.
- Rocket League engine: `docs/RL_ENGINE_STATUS.md` and
  `docs/ROCKET_LEAGUE_ENGINE.md`.
- Architecture or data boundaries: `docs/ARCHITECTURE.md`.
- Operations, release or recovery: `docs/OPERATIONS.md`.
- Riot: `docs/RIOT_INTEGRATION.md`.
- Source provenance: `docs/SOURCE_EXPORT.md`.

## Generated artifact guard

Never read these files wholesale unless the current task explicitly concerns
Rocket League calibration or review data:

- `docs/RL_ENGINE_BASELINE.json`
- `docs/RL_REVIEW_QUEUE.json`
- `docs/RL_REVIEW_MOMENTS.json`

Use targeted inspection when these artifacts are genuinely needed.

## Hard scope guard

- Do not continue automatically to adjacent roadmap milestones.
- Do not turn an audit or research into implementation unless explicitly asked.
- Do not expand a frontend task into pricing, Stripe, database, engine, GitHub
  or deployment work unless explicitly asked.
- When the requested deliverable is complete, report and stop.

## Git and release guard

Do not infer permission to commit, push, create a PR, merge, modify `main`,
deploy to Sites or change production configuration. Each action requires
explicit authorization in the current turn. A request to implement or test code
is not permission to publish it.

## Validation guard

Run only checks relevant to the files and task being changed. Do not broaden
validation into unrelated systems or add or install dependencies unless the
explicitly requested task requires them.

## Loop and compaction guard

If execution repeats the same next-step statement without concrete progress,
stop. If two consecutive context-compaction or reorientation cycles occur
without a new concrete edit, test result or requested deliverable, stop and
report `BLOCKED`. Do not reread the same files after compaction unless new
information requires it, and do not keep announcing the same pending action.
Preserve the working tree and report exact progress instead.

## Permanent product safeguards

Preserve evidence-first coaching, deterministic evidence before AI explanation,
explicit abstention, detector accuracy, privacy, truthful marketing and
protected `main`. Do not weaken them for speed.
