# Replay Method founder-manual requirements

This document translates the 21 August 2026 reread of the Founder Grade Strategic Operating Manual into product requirements. The manual remains the authority; this file is an execution check, not a replacement.

## Product definition

Replay Method is the improvement-intelligence layer between playing and improving. The product must move a player from:

`What happened? → Why did it happen? → What should I practice next?`

The durable loop is:

`Diagnosis → training → verification → growth`

The product is not an AI wrapper, generic dashboard, stat tracker, or engagement system.

## Commercial UX invariants

Every customer-facing change must satisfy all of these:

1. A cold visitor recognizes the problem immediately: “I am stuck and do not know why.”
2. The product interaction appears before deep explanation.
3. There is one obvious next action in each state.
4. The visible story is no longer than `choose game → give evidence → receive the next useful outcome`.
5. Context is progressive: do not show questions before they are needed.
6. Email is collected at the latest safe point before a valuable result or, for calibration, only after a replay is locally accepted.
7. Pricing follows product proof. It may remove uncertainty but must not interrupt first value.
8. Mobile is a primary acquisition experience, not a reduced desktop page.
9. Evidence strength, limitations, and abstention are visible product behavior.
10. No fake result, social proof, scarcity, AI claim, or rank guarantee.

## Homepage contract

The manual's six required jobs remain, in this order:

1. Problem recognition.
2. Product interaction.
3. Improvement loop.
4. Clearly labeled product proof.
5. Transparent pricing.
6. Direct objection handling.

The first viewport now combines jobs 1 and 2. Navigation is secondary and does not create competing primary actions.

## Current implementation truth

| Requirement | Current state | Next evidence required |
| --- | --- | --- |
| One first action | Implemented: choose a game; Rocket League can expose replay intake directly | Mobile and cold-user observation |
| Three-step red thread | Implemented: Replay → Focus → Improve | Comprehension test |
| Progressive replay intake | Implemented: file first, minimum context second | Real completion data |
| Honest calibration path | Implemented behind independent fail-closed flag | Storage/migration activation approval |
| Private replay custody | Implemented with R2, D1 metadata, hashes, limits, and owner-only retrieval | Live infrastructure smoke test |
| Exact subject identity | Implemented in calibration manifest and offline runner | Consented real replay test |
| Two independent qualified reviewers | Enforced in gate metrics | Two real qualified reviewers |
| Trustworthy public Rocket League report | Not ready | Representative corpus and every quality gate |
| Retention/progression proof | Architecture exists; evidence absent | Returning beta cohort |
| Payments | Implemented but closed | Value, retention, tax/legal and detector readiness |
| Multi-game expansion | Intentionally deferred | Rocket League success first |

## Locked critical path

1. Collect consented, representative Rocket League 2v2 replays.
2. Parse each replay against the exact declared player.
3. Produce private, versioned detector candidates.
4. Obtain independent qualified labels with timestamp checks.
5. Measure false positives, agreement, cohorts, drift, reproducibility and abstention.
6. Open a private player beta only when useful output is real.
7. Measure activation, report usefulness, next-match action and return behavior.
8. Activate payment only after repeated value is demonstrated.
9. Expand games only after the Rocket League loop works.

Secondary content, SEO and visual polish must not displace this path.

## Release boundaries

- Calibration intake, public detectors, background processing, email and checkout remain separate kill switches.
- Public detectors stay off until all gates pass; review counts alone are insufficient.
- A calibration contribution never promises a report.
- No production deployment, environment activation, payment activation or migration is implicit in a local code change.

