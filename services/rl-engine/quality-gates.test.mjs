import assert from "node:assert/strict";
import test from "node:test";
import { assessPublicDetectorGate, wilsonLowerBound } from "./quality-gates.mjs";

test("blocks an unlabeled shadow detector", () => {
  const result = assessPublicDetectorGate();
  assert.equal(result.eligible, false);
  assert.ok(result.blockedBy.includes("expert_labels"));
  assert.ok(result.blockedBy.includes("precision"));
  assert.ok(result.blockedBy.includes("precision_lower_bound"));
  assert.ok(result.blockedBy.includes("abstention_rule"));
});

test("allows only a detector that passes every evidence gate", () => {
  const result = assessPublicDetectorGate({
    replayCount: 75,
    reviewedPositives: 50,
    reviewedNegatives: 60,
    precision: 0.94,
    precisionLowerBound: 0.88,
    falsePositiveRate: 0.04,
    timestampVerifiedRate: 0.98,
    rankModeCohorts: 4,
    minimumCohortSamples: 8,
    independentReviewers: 3,
    reviewerAgreement: 0.78,
    labelProvenanceComplete: true,
    patchRegressionPassed: true,
    versionDriftPassed: true,
    confidenceCalibrationPassed: true,
    reproducibilityPassed: true,
    detectorDependenciesPassed: true,
    conflictResolutionTested: true,
    expertLabelSetVersion: "rl-labels@1",
    abstentionRuleTested: true,
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockedBy, []);
});

test("uses a conservative confidence bound instead of trusting a tiny perfect sample", () => {
  assert.ok(wilsonLowerBound(3, 3) < 0.5);
  assert.ok(wilsonLowerBound(97, 100) > 0.9);
  const result = assessPublicDetectorGate({
    replayCount: 75,
    reviewedPositives: 3,
    reviewedNegatives: 0,
    precision: 1,
    precisionLowerBound: wilsonLowerBound(3, 3),
    falsePositiveRate: 0,
    timestampVerifiedRate: 1,
    rankModeCohorts: 4,
    minimumCohortSamples: 8,
    independentReviewers: 3,
    reviewerAgreement: 0.78,
    labelProvenanceComplete: true,
    patchRegressionPassed: true,
    versionDriftPassed: true,
    confidenceCalibrationPassed: true,
    reproducibilityPassed: true,
    detectorDependenciesPassed: true,
    conflictResolutionTested: true,
    expertLabelSetVersion: "rl-labels@1",
    abstentionRuleTested: true,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockedBy.includes("precision_lower_bound"));
});
