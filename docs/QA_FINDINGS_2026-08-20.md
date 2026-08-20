# Replay Method QA findings — 2026-08-20

## Outcome

The local product now has one understandable acquisition path, explicit capability boundaries, responsive layouts, recoverable report states and a permanent browser regression suite. No local blocker or high-severity functional defect remains open in the supported, intentionally available flows.

This is not a production-release claim. The public site still shows the previous build until a separately authorized commit, push and Sites deployment are completed.

## Confirmed defects fixed

### Blocker — analysis could spin forever

- Symptom: a private report could remain at “Reading match data” indefinitely.
- Root cause: a terminated background execution could leave a durable job in `running`; normal report polling woke scheduled retries but did not reclaim a stale running lease.
- Fix: a three-minute lease, atomic stale-job recovery, retry exhaustion handling, immediate polling and a concrete recovery state instead of an endless spinner.
- Verification: local loading, stale, blocked and ready report browser journeys pass.

### High — wrong player name was a dead end

- Symptom: the replay parsed successfully, but a mismatched player name blocked the analysis and told the user to contact operations.
- Root cause: the parser knew the replay roster, but that structured recovery data was discarded before the private report.
- Fix: pass a bounded candidate roster through the authenticated engine contract, preserve it only in private job context, show the choices on the private report and retry the same stored replay after selection.
- Verification: the owner-supplied replay returns a candidate roster for a non-match and continues with a matching identity; desktop and mobile browser journeys cover the selection and no-reupload retry.

### High — product UI collected evidence for unavailable lanes

- Symptom: PC replay, console video and Riot flows appeared more available than their actual backend capability.
- Fix: Rocket League PC intake requires both the engine and public detector flags; console requires its separate video-analysis flag; Riot remains an official-access request. Closed lanes stop before file collection.
- Verification: browser and API tests confirm that closed inputs are rejected before storage.

### High — desktop and mobile page hierarchy was noisy and repetitive

- Symptom: duplicated demos, large illustrative mini-games, long copy and repeated calls to action obscured the basic value proposition.
- Fix: one funnel—problem, decision, next move, availability, free test—with a compact game-specific decision preview and one primary free action.
- Verification: all three game routes have distinct copy and interaction; the public route matrix has no horizontal overflow or clipped form controls at seven required viewport sizes.

### Medium — checkout-return generated an expected browser error

- Symptom: opening the checkout-return page without a player session produced an HTTP 401 console error.
- Fix: the read-only billing probe treats an anonymous visitor as a normal empty state while mutation endpoints remain authenticated and same-origin protected.

## Verified product truth

- Rocket League is the only implemented deep replay parser.
- Public Rocket League coaching remains closed until detector calibration passes.
- PS5, Xbox and Switch video analysis is not implemented; the site must present a waitlist, not a working analyzer.
- League of Legends and VALORANT ingestion remains pending approved Riot production access and opt-in account connection.
- Pricing is visible, but paid checkout remains intentionally closed until detector quality, Stripe price configuration, tax, legal, platform and cost gates pass.
- The free Climb Check is a self-reported hypothesis tool, not match analysis.

## Permanent regression gate

- Lint and verified production build.
- 113 passing Node unit and integration checks, including the Rocket League engine contract.
- 64 scheduled Chromium checks: 57 passing desktop/mobile journeys and seven intentional duplicate viewport-matrix skips in the mobile project.
- Explicit viewport checks at 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844 and 360×800.
- CI installs Chromium and runs the browser suite before release.

## Remaining launch blockers

1. Expert-review a representative Rocket League replay set and activate only detector versions that pass the documented public quality gates.
2. Decide whether to build a genuine console video-analysis adapter; do not relabel video review as frame-exact replay telemetry.
3. Obtain Riot production/RSO approval before enabling League or VALORANT ingestion.
4. Complete Stripe test-mode success, cancel, webhook-idempotency, customer-portal and subscription-state verification with the final Price IDs.
5. Approve tax, legal, age, platform and unit-cost gates before enabling paid checkout.
6. After explicit authorization, commit, push, deploy, then run a read-only production smoke test and confirm recovery on the owner-provided private report.
