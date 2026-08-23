# Early Access beta runbook — 2026-08-23

## Product boundary

The free Rocket League PC beta has two independent truth layers:

1. parser-verified match facts;
2. explicitly experimental coaching output, when the replay itself clears the
   bounded Early Access evidence policy.

Formal detector validation is unchanged. `RL_PUBLIC_DETECTORS_ENABLED` stays
off, detector registry entries stay non-public, and Early Access reports must
not imply individual human review or professional validation. Checkout and
Stripe live payments stay off.

Customer analysis replays are processed only to deliver the requested report.
They must not enter calibration, training or evaluation without a separate
explicit opt-in through the calibration contribution flow. Report feedback is
product evidence and must not be imported into `rl_review_labels`.

## Activation and immediate rollback

Both environments must contain `RL_EARLY_ACCESS_OUTPUT_ENABLED=true`:

- Sites/web worker: requests the Early Access tier for a replay job.
- replay-engine host: permits the tier at the processing boundary.

Either switch being absent or anything other than the exact string `true`
stops new experimental output. Turning off the Sites switch also hides persisted
experimental coaching at the report/API delivery layer while leaving verified
facts visible. The rollback sequence is:

1. set `RL_EARLY_ACCESS_OUTPUT_ENABLED=false` in Sites or the replay-engine
   host;
2. deploy only that configuration revision;
3. verify Mission Control reports the Sites switch as `OFF / GATED`;
4. submit an authorized canary and confirm it returns the safe verified-parse
   state without experimental coaching;
5. leave `RL_PUBLIC_DETECTORS_ENABLED=false` and checkout off throughout.

## Required release proof

- Full lint, build, logic/security tests and Playwright desktop/mobile matrix.
- Engine contract proves that both host permission and web request are needed.
- Genuine external PC replay: upload, parsed roster, exact player selection,
  idempotent continuation, complete facts report, experimental insight or local
  abstention, and feedback write.
- One prior `public_output_disabled` analysis upgraded through the existing
  admin retry route. The existing job and usage row must be reused; row counts
  and allowance slot must not increase.
- Private report access, no-store/no-referrer headers, upload rate limits,
  deletion, privacy copy and separate calibration consent remain intact.
- Product review commercial desktop and UX mobile journeys remain green.

## Early Access policy revision 0.1.0

Only two direct telemetry interpretations are currently eligible:

- `boost.supersonic_waste`: at least three independent timestamped boost inputs
  and at least six measured boost units spent while already supersonic;
- `teamplay.double_commit`: at least two independent timestamped overlap
  windows and at least 0.4 measured seconds with both subject and teammate near
  and moving toward the ball.

The displayed 65–79% value is within-match evidence strength based on repeated
windows. It is explicitly not accuracy, formal detector precision or rank-up
probability. All other shadow detectors abstain from Early Access coaching. If
neither eligible interpretation passes, the request still completes as a
verified-facts report and consumes the one analysis it fully processed.
