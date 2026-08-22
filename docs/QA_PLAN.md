# Replay Method QA plan

This is the permanent release checklist for the public product. The evidence-first and fail-closed product boundaries in `AGENTS.md` and `docs/MASTER_PRODUCT_BRIEF.md` remain authoritative.

## Environments

- Local development: `http://127.0.0.1:5175`
- Production smoke test: `https://replaymethod.xyz`
- Stripe: test mode only; never complete a live charge during QA
- Rocket League engine: local authenticated engine or the separately approved production engine

Do not write production customer data during automated smoke tests. Report URLs are private bearer links and must never be copied into logs, analytics, screenshots committed to Git, or public issue trackers.

## Test data

- Rocket League replay: owner-supplied local fixture; never copy it into the repository or test artifacts
- Matching player: select one exact identity parsed from the local fixture roster
- Other players: use only the structured candidate list returned by the local parser
- Non-matching player: use a unique value that cannot appear in the fixture
- E2E report fixtures: local-only synthetic IDs defined in `lib/e2e-report-fixtures.ts`; the binding is false unless the Playwright server explicitly enables it
- Test email domains: use `.invalid` locally and never send transactional mail from E2E

## Critical journeys

1. New visitor understands the problem, method, availability and free next step.
2. League, VALORANT and Rocket League routes show distinct game-native copy.
3. Climb Check completes without login, card or email and labels its result as a hypothesis.
4. Rocket League PC accepts only an original supported `.replay` while the public quality gate is open.
5. A matching replay identity continues; a non-matching identity shows parsed player choices without requiring a second upload.
6. PS5, Xbox and Switch never collect video while the video-analysis engine is closed.
7. League and VALORANT remain official-access requests until approved Riot ingestion is live.
8. A report shows loading, recoverable interruption, terminal error and ready states truthfully.
9. Pricing shows free, monthly, three-month and six-month options with the charged total and renewal cadence.
10. Checkout tests use Stripe test mode only and cover cancel, success, webhook idempotency and portal cancellation.
11. Privacy, terms, beta terms, guides, reports and error routes remain reachable.

## Responsive matrix

- 1440 × 900
- 1280 × 800
- 1024 × 768
- 768 × 1024
- 430 × 932
- 390 × 844
- 360 × 800

At every size, reject horizontal overflow, clipped controls, overlapping text, off-screen tabs, unreadable report visuals and hover-only required actions. Primary touch controls should be at least 44 CSS pixels where practical; no essential target may be smaller than 24 × 24 CSS pixels.

## Acceptance criteria

- No blocker or high-severity functional finding remains open.
- `npm run lint`, `npm test` and `npm run test:e2e` pass.
- Production build and Sites artifact validation pass.
- No browser `pageerror` or console error appears on critical public routes.
- The analysis API rejects unsupported or closed inputs before storing files.
- A worker interruption becomes retry, terminal failure or a concrete recovery state within three minutes; it never spins forever.
- Public claims match active feature flags and backend capability.
- Checkout remains closed unless engine quality, Stripe, tax, platform and production gates are all approved.
- No secret, replay, private URL, customer email or generated Playwright artifact is committed.

## Known launch limitations

- Rocket League is the only deep replay adapter. Its public detector gate remains closed until representative expert calibration passes.
- Console video analysis is a waitlist, not a working engine.
- League and VALORANT automated ingestion require approved Riot production/RSO access.
- Paid checkout must remain closed until the legal, tax, platform, cost and detector gates documented in `docs/RELEASE_READINESS_2026-08-20.md` pass.
- The local Playwright report fixtures validate UI state transitions; they do not replace a real engine E2E run.

## Commands

```bash
npm run lint
npm test
npm run test:e2e:desktop
npm run test:e2e:mobile
npm run test:e2e
npm run test:release
```

For a read-only production smoke run, set `PLAYWRIGHT_BASE_URL=https://replaymethod.xyz` and run only tests explicitly marked safe for production. Never run form submissions, uploads or checkout against production from the generic local suite.

## Release gate

GitHub CI installs Chromium and runs lint, build/unit/integration tests and the critical Playwright journeys. A release must not be deployed when CI is red. After a separately authorized deployment, smoke-test the production homepage, three game routes, Climb Check, policy routes, pricing state and one owner-provided private report link; then record the deployed commit and remaining limitations.
