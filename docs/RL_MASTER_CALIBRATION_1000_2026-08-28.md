# Rocket League master calibration corpus: 1,000 replay protocol

Status: acquisition is running through the official Ballchasing API with a
private process-only token. The corpus remains incomplete until the private
manifest reports all 1,000 accepted replays and passes the final integrity
checks below. This document does not authorize public detector activation or
access to a frozen holdout.

## Fixed corpus

The corpus is exactly 1,000 verified ranked replays across the three latest
Rocket League seasons as of 2026-08-28:

- Season 21: 333;
- Season 22: 333;
- Season 23: 334.

Every season contains all 15 combinations of Ranked Duel, Ranked Doubles and
Ranked Standard with Gold, Platinum, Diamond, Champion and Grand Champion. The
45-cell floor is 18 replays and the maximum is 28. Aggregate mode targets are
300 1v1, 352 2v2 and 348 3v3. Rank targets are 186 Gold, 207 Platinum, 226
Diamond, 213 Champion and 168 Grand Champion.

## Acceptance rules

The official Ballchasing API is the only acquisition source. A candidate is
accepted only when all of these are true:

1. the API season, free-to-play season type, playlist and player count match the
   locked cell;
2. a player has an explicit Ballchasing rank object in the requested group;
3. every player has an attributable platform identity;
4. no player already occurs anywhere in the new 1,000-replay corpus;
5. the uploader has not exceeded four accepted replays;
6. replay ID, Rocket League ID, SHA-256 and parser match GUID are unique;
7. the binary passes minimum size, parser ingestion, player attribution and
   parser-mode verification. Parser attribution first uses the Ballchasing
   platform ID. When a console replay exposes names but not the remote ID, it
   may fall back only to the exact Ballchasing subject name when that name is
   unique in the API roster; the resolution source is retained in the private
   manifest.

Rank is never inferred from play, MMR estimates or detector output. The
permission-restricted v2 manifest keeps exclusion counts, excluded replay IDs
and up to three diagnostic samples per cell/reason; it intentionally avoids an
unbounded copy of every rejected API record. Raw `.replay` files and the
private manifest remain outside Git.

## Leakage boundary

All 45 cells must reach their exact target before split assignment. Split is
then deterministic SHA-256 order inside each cell:

- `calibration_dev`: 700;
- `challenge`: 150;
- `frozen_blind_holdout`: 150.

The player cap of one prevents player identity overlap between all three
splits. Parser compatibility is the only permitted inspection during
acquisition. Detector execution, threshold tuning and review selection may use
only `calibration_dev`. Challenge is release-candidate evaluation only. The new
frozen blind holdout remains unopened until the owner-authorized release gate.
The pre-existing Season 21 frozen holdout is not imported, reassigned or
opened.

## Reproducibility and stop conditions

Acquisition is atomic and resumable. The manifest stores the exact plan
version, page-commit resume state per cell, compact exclusion audit, every
acceptance, hashes, private identity fingerprints, storage paths and completion
counts. A discovery cursor is committed only after its complete page has been
processed, so interruption cannot silently skip the remainder of a page.
Migration from the earlier cursor format restarts incomplete cells from their
locked initial query and relies on deduplication to repair any possible gap.
Resuming with a different prior-manifest set fails closed.

Calibration requires two full `calibration_dev` runs. Each run is split into 20
deterministic shards to stay below the JavaScript report-size ceiling, then
verified and summarized against the private corpus manifest. Both runs require:

- 700/700 successful parser and subject attributions;
- zero mode mismatches, duplicate opportunities or detector errors;
- identical reproducibility fingerprint;
- identical canonical opportunity-outcome hash;
- 60 measuring contracts and zero capability abstentions.

After deterministic execution, the toolchain must generate anonymized moments,
two model-blind reviewer packets, independent decisions and separate
adjudication. No precision, recall, expert agreement or “fully calibrated”
claim exists until the owner completes that human evidence gate.

## Commands

Acquisition requires the token outside source control:

```bash
BALLCHASING_API_TOKEN="..." npm run rl-corpus:master-acquire -- \
  --output private-corpus/master-s21-s23-1000 \
  --prior-manifest /absolute/path/to/prior/private-manifest.json
```

Calibration must select only the manifest-locked development split. Run all 20
shards for A and B, summarize each set against the corpus manifest, then compare
the two summaries:

```bash
npm run rl-engine:calibrate -- \
  private-corpus/master-s21-s23-1000/approved \
  --metadata private-corpus/master-s21-s23-1000/private-manifest.json \
  --split calibration_dev \
  --shard-index 0 --shard-count 20 \
  --output /private/output/master-run-a-shard-0.json

npm run rl-engine:calibration-shards -- \
  /private/output/master-run-a-shard-*.json \
  --output /private/output/master-run-a-manifest.json \
  --corpus-manifest private-corpus/master-s21-s23-1000/private-manifest.json \
  --expected-replays 700 --expected-detectors 60

npm run rl-engine:calibration-compare -- \
  --left /private/output/master-run-a-manifest.json \
  --right /private/output/master-run-b-manifest.json
```

The same 20-shard process is required for run B. Operational timestamps and
durations may differ; the canonical replay, detector and opportunity-outcome
fingerprint must not.
