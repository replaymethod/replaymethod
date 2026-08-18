import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  aggregateCalibrationRuns,
  buildReviewQueue,
  calibrationMetricsFromLabels,
} from "./calibration.mjs";

test("aggregates replay coverage while keeping public quality gates closed", () => {
  const report = aggregateCalibrationRuns([
    {
      mode: "Ranked Doubles", sampledFrames: 100, parserEvents: 200, decisionEvents: 40,
      replayFingerprint: "replay-a",
      shadowRuns: [{ detectorId: "boost.zero_duration", detectorVersion: "0.1.0", status: "observed", candidateCount: 3, evidence: [{ startTimeSeconds: 12, startFrame: 120 }] }],
    },
    {
      mode: "Ranked Doubles", sampledFrames: 120, parserEvents: 240, decisionEvents: 50,
      replayFingerprint: "replay-b",
      shadowRuns: [{ detectorId: "boost.zero_duration", detectorVersion: "0.1.0", status: "no_signal", candidateCount: 0, evidence: [] }],
    },
  ]);

  assert.equal(report.corpus.replayCount, 2);
  assert.equal(report.corpus.totalSampledFrames, 220);
  assert.equal(report.corpus.modes["Ranked Doubles"], 2);
  assert.equal(report.detectors[0].replayRuns, 2);
  assert.equal(report.detectors[0].candidateCount, 3);
  assert.equal(report.detectors[0].signalReplayRate, 0.5);
  assert.equal(report.detectors[0].publicQualityGate.eligible, false);
  assert.equal(report.conclusions.publicDetectorsEnabled, 0);

  const queue = buildReviewQueue(report);
  assert.equal(queue.candidates.length, 1);
  assert.equal(queue.candidates[0].timestampSeconds, 12);
  assert.equal(queue.candidates[0].label, null);
  queue.candidates[0].label = "confirmed";
  queue.candidates[0].timestampVerified = true;
  queue.labelSetVersion = "test-labels@1";
  const metrics = calibrationMetricsFromLabels(queue, "boost.zero_duration");
  assert.equal(metrics.reviewedPositives, 1);
  assert.equal(metrics.precision, 1);
  assert.equal(metrics.timestampVerifiedRate, 1);
});

test("checked-in review queue is unique, private and ready for expert labeling", async () => {
  const queue = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_QUEUE.json", import.meta.url), "utf8"));
  assert.equal(queue.schemaVersion, "rocket-league-review-queue.v1");
  assert.equal(queue.candidates.length, 515);
  assert.equal(new Set(queue.candidates.map(candidate => candidate.id)).size, queue.candidates.length);
  assert.deepEqual(new Set(queue.candidates.map(candidate => candidate.detectorId)), new Set([
    "boost.zero_duration",
    "boost.supersonic_waste",
    "kickoff.speed",
    "possession.first_touch",
    "challenge.dive",
    "rotation.spacing_too_close",
    "teamplay.double_commit",
    "recovery.momentum_loss",
  ]));
  assert.ok(queue.candidates.every(candidate => candidate.label === null));
  assert.ok(queue.candidates.every(candidate => candidate.replayFingerprint && candidate.reviewQuestion));
});

test("checked-in replay moments cover every candidate without player identifiers", async () => {
  const queue = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_QUEUE.json", import.meta.url), "utf8"));
  const artifact = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_MOMENTS.json", import.meta.url), "utf8"));
  assert.equal(artifact.schemaVersion, "rocket-league-review-moments.v1");
  assert.equal(artifact.replayCount, 6);
  assert.equal(artifact.candidateCount, queue.candidates.length);
  assert.equal(artifact.missingCandidateCount, 0);
  assert.deepEqual(artifact.missingReplays, []);
  for (const candidate of queue.candidates) {
    const moment = artifact.moments[candidate.id];
    assert.ok(moment, `missing moment ${candidate.id}`);
    assert.ok(moment.frames.length >= 10);
    assert.ok(moment.roster.every((player) => /^P\d+$/.test(player.id)));
    assert.equal(moment.roster.filter((player) => player.subject).length, 1);
  }
});
