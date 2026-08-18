import assert from "node:assert/strict";
import test from "node:test";
import { assessPublicDetectorGate } from "./quality-gates.mjs";

test("blocks an unlabeled shadow detector", () => {
  const result = assessPublicDetectorGate();
  assert.equal(result.eligible, false);
  assert.ok(result.blockedBy.includes("expert_labels"));
  assert.ok(result.blockedBy.includes("precision"));
  assert.ok(result.blockedBy.includes("abstention_rule"));
});

test("allows only a detector that passes every evidence gate", () => {
  const result = assessPublicDetectorGate({
    replayCount: 75,
    reviewedPositives: 50,
    reviewedNegatives: 60,
    precision: 0.94,
    falsePositiveRate: 0.04,
    timestampVerifiedRate: 0.98,
    rankModeCohorts: 4,
    patchRegressionPassed: true,
    expertLabelSetVersion: "rl-labels@1",
    abstentionRuleTested: true,
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockedBy, []);
});
