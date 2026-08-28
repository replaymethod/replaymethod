import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseCalibrationShardManifest } from "./calibration-diagnostics.mjs";

test("calibration diagnostics flags coverage pathologies without claiming accuracy", () => {
  const diagnostics = diagnoseCalibrationShardManifest({
    reproducibilityFingerprint: "a".repeat(64),
    detectors: [
      { detectorId: "zero", detectorVersion: "1", replayRuns: 2, executionErrors: 0, opportunities: { total: 0 } },
      { detectorId: "one-sided", detectorVersion: "1", replayRuns: 2, executionErrors: 0, opportunityReplayCount: 2,
        opportunities: { firing: 100, non_firing: 0, abstained: 0, total: 100 }, opportunityModes: { "2v2": 100 } },
    ],
  });
  assert.deepEqual(diagnostics.detectors[0].issues, ["no_opportunity_denominator"]);
  assert.deepEqual(diagnostics.detectors[1].issues, ["no_non_firing_examples", "extreme_engine_decision_rate"]);
  assert.match(diagnostics.scope, /not expert accuracy/);
});
