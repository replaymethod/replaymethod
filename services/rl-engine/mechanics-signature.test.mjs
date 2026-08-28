import assert from "node:assert/strict";
import test from "node:test";
import { MECHANICS_MODEL_VERSION } from "./mechanics-model.mjs";
import {
  buildMechanicsSignature,
  compareMechanicsSignatures,
  MECHANICS_SIGNATURE_COMPARISON_VERSION,
  MECHANICS_SIGNATURE_VERSION,
} from "./mechanics-signature.mjs";

function model(index) {
  return {
    schemaVersion: MECHANICS_MODEL_VERSION,
    touches: [{ eligible: true, contactSurface: "ground", metrics: { approachSpeed: 900 + index * 10, postTouchMedianDistanceToBall: 300 + index * 5 } }],
    recoveries: [{ eligible: true, sourceSurface: "aerial", metrics: { uprightDeviationDegrees: 10 + index, timeToUsefulSpeed: 0.5 + index * 0.02 } }],
    summary: { executionEventCounts: { wavedash: index } },
  };
}

test("builds a version-locked descriptive mechanics signature", () => {
  const inputs = Array.from({ length: 5 }, (_, index) => ({ replayId: `replay-${index}`, mechanicsModel: model(index) }));
  const signature = buildMechanicsSignature(inputs, { minimumSamples: 3 });
  const repeated = buildMechanicsSignature([...inputs].reverse(), { minimumSamples: 3 });
  assert.equal(signature.schemaVersion, MECHANICS_SIGNATURE_VERSION);
  assert.match(signature.comparisonKey, /^msc_/);
  assert.equal(signature.status, "measured");
  assert.equal(signature.replayCount, 5);
  assert.equal(signature.touchBySurface.ground.metrics.approachSpeed.sampleCount, 5);
  assert.equal(signature.recoveryBySourceSurface.aerial.metrics.timeToUsefulSpeed.status, "measured");
  assert.equal(signature.executionEventCounts.wavedash, 10);
  assert.equal(signature.signatureId, repeated.signatureId);
  assert.match(signature.limitation, /not a mechanics grade/i);
});

test("fails closed on mixed model versions and insufficient exposure", () => {
  const sparse = buildMechanicsSignature([{ replayId: "one", mechanicsModel: model(1) }]);
  assert.equal(sparse.status, "insufficient_exposure");
  assert.throws(() => buildMechanicsSignature([
    { replayId: "one", mechanicsModel: model(1) },
    { replayId: "two", mechanicsModel: { ...model(2), schemaVersion: "mechanics@old" } },
  ]), /cannot mix/i);
});

test("compares compatible signatures without converting direction into an improvement claim", () => {
  const baseline = buildMechanicsSignature(Array.from({ length: 5 }, (_, index) => ({
    replayId: `baseline-${index}`,
    mechanicsModel: model(index),
  })), { minimumSamples: 3 });
  const followup = buildMechanicsSignature(Array.from({ length: 5 }, (_, index) => ({
    replayId: `followup-${index}`,
    mechanicsModel: model(index + 10),
  })), { minimumSamples: 3 });
  const comparison = compareMechanicsSignatures(baseline, followup);
  assert.equal(comparison.schemaVersion, MECHANICS_SIGNATURE_COMPARISON_VERSION);
  assert.equal(comparison.status, "descriptive_change_measured");
  assert.equal(comparison.gates.improvementClaimEligible, false);
  assert.equal(comparison.touchBySurface.ground.metrics.approachSpeed.medianDelta, 100);
  assert.equal(
    comparison.touchBySurface.ground.metrics.approachSpeed.interpretation,
    "direction_only_not_improvement",
  );
  assert.match(comparison.limitation, /do not establish improvement/i);
});

test("fails closed for incompatible, identical or sparse signature comparisons", () => {
  const baseline = buildMechanicsSignature(Array.from({ length: 5 }, (_, index) => ({
    replayId: `baseline-${index}`,
    mechanicsModel: model(index),
  })), { minimumSamples: 3 });
  assert.throws(() => compareMechanicsSignatures(baseline, baseline), /distinct/i);

  const incompatible = buildMechanicsSignature(Array.from({ length: 5 }, (_, index) => ({
    replayId: `followup-${index}`,
    mechanicsModel: model(index),
  })), { minimumSamples: 4 });
  assert.throws(() => compareMechanicsSignatures(baseline, incompatible), /not version- and threshold-compatible/i);

  const sparseBaseline = buildMechanicsSignature([{ replayId: "sparse-a", mechanicsModel: model(1) }], { minimumSamples: 3 });
  const sparseFollowup = buildMechanicsSignature([{ replayId: "sparse-b", mechanicsModel: model(2) }], { minimumSamples: 3 });
  const sparse = compareMechanicsSignatures(sparseBaseline, sparseFollowup);
  assert.equal(sparse.status, "insufficient_exposure");
  assert.equal(sparse.gates.improvementClaimEligible, false);
});
