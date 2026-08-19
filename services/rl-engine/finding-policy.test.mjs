import assert from "node:assert/strict";
import test from "node:test";
import { findingPriority, resolveFindings } from "./finding-policy.mjs";

const finding = (overrides = {}) => ({
  detectorId: "challenge.dive",
  detectorVersion: "0.1.0",
  confidence: 0.92,
  confidenceLabel: "high",
  recurrence: 0.7,
  impact: 0.8,
  trainability: 0.8,
  contextRelevance: 0.9,
  sampleSize: 4,
  evidence: [{ timeSeconds: 10 }],
  qualityGate: { eligible: true },
  activation: { valid: true },
  ...overrides,
});

test("priority preserves active focus and regression without overriding truth gates", () => {
  const base = findingPriority(finding());
  const active = findingPriority(finding(), { activeDetectorId: "challenge.dive", regressingDetectorIds: ["challenge.dive"] });
  assert.ok(active.score > base.score);
  assert.equal(findingPriority(finding({ prerequisiteReady: false })).score, 0);
});

test("suppresses invalid, under-sampled, duplicate and conflicting findings deterministically", () => {
  const result = resolveFindings([
    finding(),
    finding({ detectorId: "teamplay.double_commit", confidence: 0.88, sampleSize: 3 }),
    finding({ detectorId: "rotation.spacing_too_close", confidence: 0.7, sampleSize: 4 }),
    finding({ detectorId: "kickoff.speed", sampleSize: 1 }),
    finding({ detectorId: "recovery.momentum_loss", activation: { valid: false } }),
  ], {
    context: { mode: "Ranked Doubles", rank: "Champion II" },
    enabledDetectorIds: ["challenge.dive", "teamplay.double_commit", "rotation.spacing_too_close", "kickoff.speed", "recovery.momentum_loss"],
  });
  assert.deepEqual(result.selected.map((item) => item.detectorId), ["challenge.dive", "teamplay.double_commit"]);
  assert.ok(result.suppressed.some((item) => item.detectorId === "rotation.spacing_too_close" && item.reasons.includes("duplicate_finding")));
  assert.ok(result.suppressed.some((item) => item.detectorId === "kickoff.speed" && item.reasons.includes("insufficient_sample")));
  assert.ok(result.suppressed.some((item) => item.detectorId === "recovery.momentum_loss" && item.reasons.includes("activation_not_validated")));
});
