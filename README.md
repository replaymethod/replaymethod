# Replay Method

[![CI](https://github.com/replaymethod/replaymethod/actions/workflows/ci.yml/badge.svg)](https://github.com/replaymethod/replaymethod/actions/workflows/ci.yml)

**AI coaching for competitive gamers, grounded in real gameplay evidence.**

[Visit Replay Method](https://replaymethod.xyz) · [Contact](mailto:contact@replaymethod.xyz)

Replay Method is being built to answer one question after every match:

> What is the single biggest recurring weakness holding this player back—and what should they practice next?

The goal is not another stats dashboard or a generic AI report. Replay Method turns real match evidence into a focused improvement loop:

**Play → Analyze → Diagnose → Train → Play again → Measure → Adapt**

## Product vision

Replay Method is designed to become a personal competitive coach that understands a player's history across matches and helps them improve over time.

Initial games:

- Rocket League
- League of Legends
- VALORANT

The architecture is game-agnostic so additional competitive games can be supported through dedicated adapters and analysis engines.

## Product principles

- **Evidence before explanation.** Coaching claims must be supported by real match data.
- **One primary leak.** Prioritize the most impactful recurring weakness instead of overwhelming the player.
- **Deterministic analysis first.** Parsers, metrics, and detectors establish facts; AI explains and personalizes them.
- **Honest uncertainty.** The system should abstain when the available evidence is insufficient.
- **Progress over reports.** Every analysis should inform what to practice and what to measure next.

## Analysis architecture

```text
Raw match or replay data
        ↓
Game adapter and parser
        ↓
Structured events and metrics
        ↓
Pattern detection
        ↓
Confidence, severity, and evidence
        ↓
Universal coaching findings
        ↓
AI explanation and training plan
        ↓
Private report and player model
```

Language models are used to explain, prioritize, and personalize verified findings—not to invent gameplay events, timestamps, or outcomes.

## Current status

Replay Method is in early development and beta validation.

The live product foundation includes:

- Responsive landing and game-selection flows
- Analysis intake and Rocket League `.replay` uploads
- Private file storage and persistent analysis jobs
- Private report links and report history
- Feedback, funnel analytics, and admin monitoring
- Retry, report review and a private Rocket League detector-calibration lab with
  anonymized interactive replay moments
- Privacy and beta terms

Important limitations today:

- Uploaded Rocket League replay files are stored, but the production parsing and coaching engine is not yet fully automated.
- League of Legends and VALORANT VOD analysis is not yet automated.
- Automatic report generation and transactional email delivery are not yet production-ready.
- No coaching claim should be treated as complete until it has been validated end to end against real match evidence.

## Current priorities

1. Build and deploy the production Rocket League replay worker.
2. Validate detectors against a diverse dataset of real ranked replays.
3. Automate evidence-based reports and email delivery.
4. Add safe failure and abstention states.
5. Extend the game-adapter model to VALORANT and League of Legends.
6. Track player improvement across repeated analyses.

## Current game support

| Game | Ingestion | Current state |
| --- | --- | --- |
| Rocket League | Original `.replay` file | Web intake and durable job pipeline work. The dedicated replay-engine service must be deployed and calibrated before automated findings are enabled publicly. |
| League of Legends | Riot account and match history | The shared adapter boundary and a truthful blocked state exist. Production API and Riot Sign On approval remain external blockers. |
| VALORANT | Riot account and match history | The shared adapter boundary and a truthful blocked state exist. Production API and Riot Sign On approval remain external blockers. |

## Repository map

- `app/` — landing pages, intake, private reports, admin and API routes
- `lib/core/` — universal coaching contracts, pipeline and synthesis
- `lib/adapters/` — game-specific ingestion boundaries
- `db/` and `drizzle/` — portable schema and versioned migrations
- `worker/` — Cloudflare request entry point and background scheduling hook
- `services/rl-engine/` — standalone Rocket League replay service
- `scripts/calibrate-rl-engine.mjs` — real-replay shadow calibration runner
- `tests/` — build, route and engine regression checks

Architecture and operating details live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/ROCKET_LEAGUE_ENGINE.md](docs/ROCKET_LEAGUE_ENGINE.md), and [docs/RIOT_INTEGRATION.md](docs/RIOT_INTEGRATION.md).

The durable product source of truth is
[`docs/MASTER_PRODUCT_BRIEF.md`](docs/MASTER_PRODUCT_BRIEF.md). The product and
detector strategy is grounded in a review of 22 coaching,
analytics, replay, training and video products documented in
[docs/COMPETITIVE_INTELLIGENCE.md](docs/COMPETITIVE_INTELLIGENCE.md).
Current Rocket League parser, shadow-detector and calibration status is tracked
in [docs/RL_ENGINE_STATUS.md](docs/RL_ENGINE_STATUS.md).

## Local development

Requirements:

- Node.js 22.13 or newer
- Linux or macOS shell for the existing build helpers

```bash
npm ci
npm run dev
```

Copy `.env.example` to a local, ignored environment file and add only the credentials needed for the integration you are testing. Never commit secrets.

Useful checks:

```bash
npm run lint
npm run build
npm test
```

## Deployment and portability

The existing Sites project is declared in `.openai/hosting.json`. A future migration target needs a Next-compatible web runtime, a SQLite/Postgres-equivalent database, S3/R2-compatible private object storage, background job execution, and a container or native host for the Rocket League engine.

The domain remains under owner control and can point to another host later. No payment system is active; pricing shown on the landing page is a founding hypothesis, not a charged subscription. The researched free-to-paid model, market comparison and launch guardrails are documented in [`docs/MONETIZATION_STRATEGY.md`](docs/MONETIZATION_STRATEGY.md).

## Security and ownership

Secrets and runtime credentials must never be committed to Git. This repository will contain source code, migrations, architecture documentation, deployment guidance, an environment-variable template, and recovery documentation so the project remains portable and founder-owned.

## Contact

Replay Method is being built by Rafael Westin.

- Website: [replaymethod.xyz](https://replaymethod.xyz)
- Email: [contact@replaymethod.xyz](mailto:contact@replaymethod.xyz)

---

*The repository source was exported from exact Site version 16 and is being validated before merge.*
