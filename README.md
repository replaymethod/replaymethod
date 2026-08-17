# Replay Method

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
- Retry and review workflows
- Privacy and beta terms

Important limitations today:

- Uploaded Rocket League replay files are stored, but the production parsing and coaching engine is not yet fully automated.
- League of Legends and VALORANT VOD analysis is not yet automated.
- Automatic report generation and transactional email delivery are not yet production-ready.
- No coaching claim should be treated as complete until it has been validated end to end against real match evidence.

## Current priorities

1. Move and preserve the complete existing source code in this repository.
2. Build the production Rocket League replay worker.
3. Validate detectors against a diverse dataset of real ranked replays.
4. Automate evidence-based reports and email delivery.
5. Add safe failure and abstention states.
6. Extend the game-adapter model to VALORANT and League of Legends.
7. Track player improvement across repeated analyses.

## Security and ownership

Secrets and runtime credentials must never be committed to Git. This repository will contain source code, migrations, architecture documentation, deployment guidance, an environment-variable template, and recovery documentation so the project remains portable and founder-owned.

## Contact

Replay Method is being built by Rafael Westin.

- Website: [replaymethod.xyz](https://replaymethod.xyz)
- Email: [contact@replaymethod.xyz](mailto:contact@replaymethod.xyz)

---

*Source-code migration into this repository is in progress.*
