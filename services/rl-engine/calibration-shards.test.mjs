import assert from "node:assert/strict";
import test from "node:test";
import { calibrationFingerprint } from "./calibration.mjs";
import { compareCalibrationShardManifests, summarizeCalibrationShards } from "./calibration-shards.mjs";

function shard(index, replayFingerprint) {
  const report = {
    schemaVersion: "rocket-league-calibration-report.v1",
    corpus: {
      replayCount: 1, calibrationEligibleReplayCount: 1, failureCount: 0, modeMismatchCount: 0,
      attributionVerifiedCount: 1, modes: { "2v2": 1 }, totalSampledFrames: 10,
      totalParserEvents: 2, totalDecisionEvents: 3,
    },
    replays: [{
      replayFingerprint,
      mode: "2v2",
      rankCohort: "diamond",
      opportunityContracts: [{ detectorId: "challenge.quality", evaluations: [
        { opportunityId: `${replayFingerprint}:1`, status: index ? "non_firing" : "firing" },
      ] }],
    }],
    detectors: [{
      detectorId: "challenge.quality", detectorVersion: "0.9.0", replayRuns: 1,
      executionErrors: 0, replaysWithSignal: index ? 0 : 1, candidateCount: index ? 0 : 1,
      ineligibleReplayRuns: 0, notApplicableRuns: 0,
    }],
    failures: [],
    operational: { measuredReplayCount: 1, totalRuntimeMs: 10 + index, maximumObservedRssBytes: 100 + index },
    shard: { method: "sha256-prefix-modulo-v1", index, count: 2, split: "calibration_dev", replayCount: 1 },
  };
  return { ...report, reproducibilityFingerprint: calibrationFingerprint(report) };
}

test("calibration shard manifest validates and aggregates a complete deterministic set", () => {
  const reports = [shard(1, "b".repeat(16)), shard(0, "a".repeat(16))];
  const corpusRows = [
    { sha256: "a".repeat(64), split: "calibration_dev", cellKey: "S21:2v2:Diamond", season: 21, mode: "2v2", rankGroup: "Diamond" },
    { sha256: "b".repeat(64), split: "calibration_dev", cellKey: "S22:2v2:Diamond", season: 22, mode: "2v2", rankGroup: "Diamond" },
  ];
  const summary = summarizeCalibrationShards(reports, { corpusRows, sourceManifestPlanVersion: "plan-v1" });
  assert.equal(summary.corpus.replayCount, 2);
  assert.deepEqual(summary.corpus.modes, { "2v2": 2 });
  assert.deepEqual(summary.detectors[0].opportunities, { firing: 1, non_firing: 1, abstained: 0, total: 2 });
  assert.deepEqual(summary.detectors[0].opportunityModes, { "2v2": 2 });
  assert.equal(summary.corpusLineage.exactReplaySetMatched, true);
  assert.deepEqual(summary.corpusLineage.composition.seasons, { 21: 1, 22: 1 });
  assert.equal(summary.conclusions.integrityPassed, true);
  assert.equal(compareCalibrationShardManifests(summary, summarizeCalibrationShards(reports, {
    corpusRows, sourceManifestPlanVersion: "plan-v1",
  })).reproducible, true);
});

test("calibration shard manifest rejects missing, duplicate and cross-shard replay data", () => {
  assert.throws(() => summarizeCalibrationShards([shard(0, "a".repeat(16))]), /declared number/);
  assert.throws(() => summarizeCalibrationShards([shard(0, "a".repeat(16)), shard(0, "b".repeat(16))]), /unique and complete/);
  assert.throws(() => summarizeCalibrationShards([shard(0, "a".repeat(16)), shard(1, "a".repeat(16))]), /unique across/);
  assert.throws(() => summarizeCalibrationShards([
    shard(0, "a".repeat(16)), shard(1, "b".repeat(16)),
  ], { corpusRows: [
    { sha256: "a".repeat(64), split: "calibration_dev" },
    { sha256: "c".repeat(64), split: "calibration_dev" },
  ] }), /exactly cover/);
});
