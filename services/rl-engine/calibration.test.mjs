import assert from "node:assert/strict";
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
