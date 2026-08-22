# Rocket League beta replay collection runbook

## Purpose

Recruit real Rocket League players to contribute original PC `.replay` files for private engine calibration. This is not yet the player analysis beta and must never be marketed as one.

## Customer path

- Campaign URL: `/rocket-league-beta?utm_source=<source>&utm_campaign=<campaign>`
- Product page: `/rocket-league` exposes the same replay-first action when collection is open.
- Visible flow: choose replay → email, exact player name and 2v2 rank group → consent → replay secured.
- The confirmation explicitly says that no player report is promised.

## What is collected

- Original `.replay`, maximum 16 MB.
- Email.
- Exact in-game player name for subject attribution.
- Current 2v2 rank cohort.
- Source and campaign.
- Required calibration consent and rights confirmation.
- Optional, separate beta-update consent.

Replay bytes are stored in private R2. D1 stores a random public reference, SHA-256 fingerprint, object key, context, consent version, and status. Email never appears in an object key.

## Activation checklist

All items are required before production collection opens:

- Apply the generated D1 migration for `rl_beta_submissions`.
- Verify the production R2 binding with a reversible test object.
- Verify configured owner authentication and replay download authorization.
- Confirm the privacy notice and beta/calibration terms are acceptable to the owner; obtain legal review if desired.
- Name at least two qualified reviewers and configure their identities individually through `ADMIN_USER_IDS` (preferred) or `ADMIN_EMAILS`.
- Agree on reviewer qualification (`competitive_player`, `rocket_league_coach`, or `replay_analyst`). Unverified operators do not count toward the gate.
- Set `RL_CALIBRATION_INTAKE_ENABLED=true` only after the checks above.
- Keep `RL_PUBLIC_DETECTORS_ENABLED=false` and `BILLING_CHECKOUT_ENABLED=false`.

## Recruitment copy

Safe example:

> Help us validate a Rocket League improvement engine. Contribute one original Ranked 2v2 PC replay for private research. We use it to test whether detected moments are correct and useful. This is not a promised analysis or coaching report.

Do not say “get your free analysis,” “AI coach,” “rank up,” or imply that a contributor will receive a report.

## Operator workflow

1. Open `/admin` and check `CONSENTED ROCKET LEAGUE CORPUS`.
2. Download the owner-only calibration manifest.
3. Download each replay. The filename is prefixed with its non-email public reference.
4. Place the replay files in an isolated local corpus directory outside the repository.
5. Run the private shadow calibration using the downloaded manifest:

   `npm run rl-engine:calibrate -- <corpus-directory> --metadata <manifest.json> --output <calibration-report.json>`

6. The runner must find the exact declared player in the roster. A mismatch fails with `subject_player_not_found`; do not silently select another player.
7. Build a versioned private review queue and anonymized moment artifact from the report.
8. Have two qualified reviewers label candidates independently. Repeat edits by one reviewer do not count as another reviewer.
9. Inspect per-detector precision, Wilson lower bound, false-positive rate, timestamp accuracy, cohort coverage, reviewer agreement, version drift, reproducibility, dependencies, conflict resolution and abstention.
10. Keep public detectors off unless every gate passes.

## Target corpus

The gate requires at least 50 representative replays, three valid rank/mode cohorts and at least five examples in every covered cohort, in addition to detector-specific positive and negative label minimums. Recruit beyond the numerical minimum because failed parsing, duplicates, mismatched player names and sparse detector opportunities do not count.

Initial recruitment should balance:

- Gold–Platinum 2v2.
- Diamond–Champion 2v2.
- Grand Champion–SSL 2v2.

Bronze–Silver is accepted but should not be used as a substitute for representative higher-rank coverage.

## Stop conditions

Close `RL_CALIBRATION_INTAKE_ENABLED` immediately if:

- private storage or owner-only retrieval fails;
- consent metadata is missing;
- replay files cannot be linked to their manifest safely;
- abusive or malicious uploads bypass limits;
- reviewer access is broader than intended.

Collection volume is not launch proof. Useful, reproducible, independently reviewed output is the proof.
