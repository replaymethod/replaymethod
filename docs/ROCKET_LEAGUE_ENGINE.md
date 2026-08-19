# Rocket League engine

## Selected approach

The production path is a pinned, owned adapter built around MIT-licensed `boxcars` for low-level parsing and `subtr-actor` for higher-level frame/state extraction. The web app talks only to the versioned HTTP contract in `lib/adapters`; parser libraries can be replaced without changing reports or the player model.

The authoritative engine should run as a native asynchronous service. Cloudflare WASM is a possible measured optimization, not the default: replay parsing can exceed free Worker CPU/memory limits and must not hold a public request open.

## HTTP contract

`POST /v1/analyze/rocket-league`

- bearer-token authentication
- `application/octet-stream`
- maximum 16 MiB
- `X-Replay-Method-Request`
- `X-Replay-Method-Player`
- `X-Replay-Method-Rank`

Returns either the shared `AdapterSuccess` contract or HTTP 422 for input that cannot be safely parsed/attributed. A parser success with no calibrated, supported finding must also abstain rather than invent a report.

`X-Replay-Method-Request` must be the 32-character analysis public ID. Player
and rank headers are bounded and validated before the replay body is parsed.
The web client percent-encodes cleaned player/rank headers for HTTP safety, and
the service decodes them before matching so spaces and international display
names preserve their exact identity.

## Service readiness and configuration

- `GET /livez` proves that the process can answer HTTP.
- `GET /healthz` returns 200 only when the bearer token configuration is valid;
  it also reports engine/parser versions and current concurrency.
- `RL_ENGINE_TOKEN` is required on both services and must be 24–512 characters.
- `RL_ENGINE_MAX_CONCURRENCY` defaults to 1 and is clamped to 1–8. Capacity
  responses are retryable rather than queued inside the parser process.
- `RL_ENGINE_TIMEOUT_MS` belongs to the web service, defaults to 90 seconds,
  and is clamped to 5–120 seconds.
- `RL_ENGINE_URL` must use HTTPS outside explicit loopback development.
- `RL_ENGINE_ENABLED=true` is required before the web adapter calls the worker.
- `RL_PUBLIC_DETECTORS_ENABLED=true` is a separate process-level publication
  switch; it never substitutes for a passing detector activation record.
- `BACKGROUND_PROCESSING_ENABLED=true` permits automatic retry scheduling.

The server sets bounded header/request/keep-alive behavior, drains on SIGTERM
or SIGINT, and logs only the request ID, stable error code, and retryability.
It does not log parser messages, player names, bearer tokens, or replay bytes.

## Container verification

Build from the repository root so the package lock and engine source are the
only required inputs:

```bash
docker build -f services/rl-engine/Dockerfile -t replay-method-rl-engine:local .
docker run --rm --env-file /path/to/rl-engine.env -p 8788:8788 replay-method-rl-engine:local
```

The environment file should contain `RL_ENGINE_TOKEN`, `PORT=8788`, and an
optional `RL_ENGINE_MAX_CONCURRENCY`. Never place a real token in an image,
compose file, command history, source, or screenshot. Confirm `/livez` and
`/healthz`, then exercise an authenticated invalid-file request before any
representative replay is used.

## Detector program

The candidate catalog lives in `services/rl-engine/detector-catalog.mjs`. It
currently spans boost economy, rotation, challenges, recovery, possession,
offense, defense, kickoffs and team coordination. Catalog inclusion does not make
a detector public; every entry starts in `discovery` with `public: false`.

The research and rationale behind this broader shape are recorded in
[`COMPETITIVE_INTELLIGENCE.md`](COMPETITIVE_INTELLIGENCE.md).

## Initial detector gate

Candidate detectors, in recommended precision-first order:

1. low-boost exposure in the pre-concession window
2. supersonic boost waste followed by later low-boost exposure
3. positional exposure/caught-ahead context during conceded goals

These are candidates, not public claims. Enable a detector only after:

- a representative replay fixture corpus
- player identity resolution tests
- playlist/rank calibration
- expert labels
- precision threshold agreed for beta
- evidence timestamps checked against replay playback
- patch/parser regression tests

Analyze broadly in shadow mode, but start public coaching with a small reliable
detector set. The UI already supports abstention and limitations. "One primary
leak" is a report-prioritization rule, not a restriction to one internal detector.

## Current private calibration system

Eight versioned shadow probes currently cover boost reserve, supersonic boost
waste, kickoff timing, first-touch outcomes, challenge dives, teammate spacing,
double commitments and recovery momentum loss. They execute over the full
normalized replay state and create review candidates only; none is public by
default.

Every checked-in candidate has a matching anonymized replay-moment window for
the owner-only `/admin/rl-review` lab. The viewer reconstructs the top-down
field, ball and player motion around the timestamp without retaining original
player names or platform identifiers. Expert verdicts and timestamp checks are
stored separately as an auditable versioned label set.

Public promotion additionally uses a conservative Wilson confidence floor so a
small apparently perfect sample cannot pass. The deterministic coaching
composer consumes only promoted findings, outputs one primary behavior with a
practice and verification plan, and otherwise abstains.

The detector registry defines lifecycle, exact versions, supported modes,
sample floors, dependencies, conflicts and duplicate groups. Calibration
reports fingerprint deterministic inputs, identify version drift, track cohort
coverage and reviewer agreement, and exclude synthetic fixtures from evidence
counts. Promotion and demotion are intended to persist to the additive quality
snapshot and lifecycle-event tables before an operator changes a public flag.

## Versioning

Pin and record:

- low-level parser version
- normalizer version
- detector version
- coaching version
- schema version

Keep known-good and known-bad replay fixtures. Use an independent parser as a canary on a small sample when changing parsing versions.
