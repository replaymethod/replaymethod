import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivationRecord,
  DETECTOR_REGISTRY,
  detectorDefinition,
  transitionDetector,
  validateActivationRecord,
  validateRegistry,
} from "./detector-registry.mjs";

const passingGate = { eligible: true, checks: [{ id: "all", passed: true }], blockedBy: [] };

test("registry is internally valid and public-false by default", () => {
  assert.deepEqual(validateRegistry(), { valid: true, errors: [] });
  assert.ok(DETECTOR_REGISTRY.every((entry) => entry.public === false));
  assert.deepEqual(detectorDefinition("teamplay.double_commit").supportedModes, ["2v2", "3v3"]);
});

test("activation requires exact version, gate, scope, provenance and kill switch", () => {
  const record = createActivationRecord({
    detectorId: "challenge.dive",
    detectorVersion: "0.1.0",
    parserVersion: "parser@1",
    normalizerVersion: "normalizer@1",
    cohorts: ["2v2:diamond-champion"],
    gameVersions: ["patch-a"],
    qualityGate: passingGate,
    approvedBy: "qualified-review-panel",
    approvedAt: "2026-08-19T12:00:00.000Z",
  });
  assert.equal(validateActivationRecord(record, { publicOutputEnabled: false }).valid, false);
  assert.equal(validateActivationRecord(record, { publicOutputEnabled: true }).valid, true);
  assert.throws(() => createActivationRecord({ ...record, detectorVersion: "9.9.9" }), /not registered/);
  assert.throws(() => createActivationRecord({ ...record, qualityGate: { eligible: false } }), /did not pass/);
});

test("lifecycle blocks shortcuts and requires a reason for demotion", () => {
  assert.throws(() => transitionDetector("discovery", "enabled"), /Invalid/);
  assert.throws(() => transitionDetector("enabled", "demoted"), /reason/);
  assert.equal(transitionDetector("enabled", "demoted", { reason: "precision regression", at: "now" }).to, "demoted");
});
