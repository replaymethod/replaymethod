# Rocket League engine validation — 2026-08-20

## Decision

**Parser and shadow-runtime validation: pass. Public coaching launch: blocked.**

The current engine parses the complete authorized six-replay corpus, produces
the expected evidence layers, runs all eight private probes without execution
errors, and reproduces the same versioned output across independent runs.
It does not yet have enough representative data or expert labels to support a
customer-facing coaching claim. `RL_PUBLIC_DETECTORS_ENABLED` must remain
closed.

## Actions completed

- Regenerated the calibration baseline from the external, authorized corpus.
- Regenerated the anonymized expert-review queue.
- Regenerated all private review moments and passed the built-in identifier
  leak check.
- Repeated the full corpus run and compared the reports with the engine's
  version-aware reproducibility check.
- Replaced the stale `0.1.0` generated artifacts only after the isolated run
  passed. The old review queue contained no labels, so no reviewer truth was
  overwritten.
- Did not enable a detector, deploy an engine, or change a production switch.

## Measured result

| Measure | Result |
| --- | ---: |
| Distinct real replays | 6 |
| Successfully parsed | 6 |
| Parse failures | 0 |
| Sampled frame states | 22,992 |
| Raw parser events | 52,971 |
| Decision events | 9,722 |
| Shadow detector executions | 48 |
| Detector execution errors | 0 |
| Raw shadow candidates | 739 |
| Review candidates | 515 |
| Review moments present | 515 / 515 |
| Expert labels | 0 |
| Timestamp reviews | 0 |
| Public detectors | 0 |

The `boost.supersonic_waste` detector is now version `0.2.0`. Its continuous
decision grouping reduced raw candidates from 816 to 257. The expert queue
remains capped at 120 candidates for that detector, so the total queue remains
515 rather than presenting repeated 10 Hz samples as more review coverage.

## Reproducibility

- Reproducibility fingerprint:
  `8ca92b978c6296bd4d7be63a64dd4ca36042e7842e3e0fc8d3698445f36c5e3a`
- Independent rerun comparison: reproducible.
- Version drift between runs: none.
- Parser: `subtr-actor@1.2.0`.
- Normalizer: `rocket-league-normalizer@0.2.0`.
- Shadow runtime: `rocket-league-shadow-runtime@0.2.0`.

## Blocking evidence still required

The public quality gate requires evidence that cannot be manufactured from the
current repository:

1. At least 50 representative, rights-cleared replays rather than six.
2. Coverage across at least three rank/mode cohorts, with at least five
   examples in each cohort.
3. At least two qualified, independently identified reviewers.
4. At least 30 reviewed positive and 30 reviewed negative examples for any
   detector proposed for activation.
5. At least 90% precision, at least 85% Wilson lower bound, at most 5% false
   positives, at least 95% timestamp verification and acceptable reviewer
   agreement.
6. Signed-off provenance, patch regression, confidence calibration,
   dependency/conflict and abstention evidence for the exact detector version.

## Safe next action

The owner must supply or authorize the representative corpus and qualified
reviewers. Review should begin with one detector and one supported cohort,
using `/admin/rl-review`, then expand only after label quality is stable. The
website, replay intake, payments and public detector switches must stay in
their fail-closed states until the gate is met and the engine environment is
separately approved for deployment.
