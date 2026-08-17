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

Start with a small reliable detector set. The UI already supports abstention and limitations.

## Versioning

Pin and record:

- low-level parser version
- normalizer version
- detector version
- coaching version
- schema version

Keep known-good and known-bad replay fixtures. Use an independent parser as a canary on a small sample when changing parsing versions.
