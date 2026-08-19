import assert from "node:assert/strict";
import test from "node:test";
import { explicitProgressMetric, longitudinalState, progressState, supportedFocusFinding } from "../lib/focus-policy.mjs";

function finding(overrides = {}) {
  return {
    id: "challenge.dive",
    confidence: 0.91,
    confidenceLabel: "high",
    evidence: [{ id: "e1", description: "Supported challenge event" }],
    metrics: [
      { key: "bad_commits", label: "Avoidable commitments", value: 4, unit: "events" },
      { key: "recoveries", label: "Useful recoveries", value: 7, unit: "events" },
    ],
    recommendation: { queueRule: "Force before diving." },
    ...overrides,
  };
}

test("rejects insufficient or evidence-free findings as progress truth", () => {
  assert.equal(supportedFocusFinding(finding()), true);
  assert.equal(supportedFocusFinding(finding({ confidenceLabel: "insufficient" })), false);
  assert.equal(supportedFocusFinding(finding({ evidence: [] })), false);
  assert.equal(supportedFocusFinding(finding({ confidence: Number.NaN })), false);
});

test("never guesses a progress metric from a detector's metric list", () => {
  assert.equal(explicitProgressMetric(finding()), null);
  assert.equal(explicitProgressMetric(finding({ recommendation: { queueRule: "Force first.", progressMetricKey: "missing" } })), null);
});

test("accepts only an explicitly keyed finite metric and compatible target", () => {
  const metric = explicitProgressMetric(finding({ recommendation: {
    queueRule: "Force first.",
    progressMetricKey: "bad_commits",
    targetValue: 2,
    targetUnit: "events",
    targetDirection: "decrease",
    matchesToObserve: 4,
  } }));
  assert.deepEqual(metric, {
    key: "bad_commits",
    label: "Avoidable commitments",
    value: 4,
    unit: "events",
    target: 2,
    direction: "decrease",
    minimumMatches: 4,
  });

  const mismatched = explicitProgressMetric(finding({ recommendation: {
    queueRule: "Force first.", progressMetricKey: "bad_commits", targetValue: 2,
    targetUnit: "percent", targetDirection: "decrease",
  } }));
  assert.equal(mismatched.target, null);
  assert.equal(mismatched.direction, null);
});

test("requires the observation window before declaring an explicit target met", () => {
  assert.equal(progressState({ baseline: 5, latest: 2, target: 2, direction: "decrease", matchesObserved: 2, minimumMatches: 3 }), "collecting");
  assert.equal(progressState({ baseline: 5, latest: 2, target: 2, direction: "decrease", matchesObserved: 3, minimumMatches: 3 }), "target_met");
  assert.equal(progressState({ baseline: 5, latest: 4, target: 2, direction: "decrease", matchesObserved: 3, minimumMatches: 3 }), "improving");
  assert.equal(progressState({ baseline: 5, latest: 6, target: 2, direction: "decrease", matchesObserved: 3, minimumMatches: 3 }), "regressing");
});

test("does not auto-complete evidence-only or maintain-direction observations", () => {
  assert.equal(progressState({ baseline: null, latest: null, target: null, direction: null, matchesObserved: 10, minimumMatches: 3 }), "evidence_only");
  assert.equal(progressState({ baseline: 5, latest: 5, target: 5, direction: "maintain", matchesObserved: 10, minimumMatches: 3 }), "observing");
});

test("longitudinal classification requires comparable opportunities before resolving", () => {
  const oneNonFire = longitudinalState({
    contextKey: "2v2:diamond-champion",
    evaluations: [{ detectorEvaluated: true, contextKey: "2v2:diamond-champion", opportunityCount: 1, fired: false }],
    absenceCanProveResolution: true,
  });
  assert.equal(oneNonFire.state, "insufficient_sample");

  const resolved = longitudinalState({
    contextKey: "2v2:diamond-champion",
    evaluations: Array.from({ length: 3 }, () => ({ detectorEvaluated: true, contextKey: "2v2:diamond-champion", opportunityCount: 2, fired: false })),
    absenceCanProveResolution: true,
  });
  assert.equal(resolved.state, "resolved");
});

test("longitudinal classification separates regression and context-specific behavior", () => {
  assert.equal(longitudinalState({
    contextKey: "2v2:diamond-champion", baseline: 2, direction: "decrease",
    evaluations: [2, 3, 4].map((metricValue) => ({ detectorEvaluated: true, contextKey: "2v2:diamond-champion", opportunityCount: 2, fired: true, metricValue })),
  }).state, "regressing");

  const evaluations = [
    ...Array.from({ length: 3 }, () => ({ detectorEvaluated: true, contextKey: "1v1:diamond-champion", opportunityCount: 2, fired: true })),
    ...Array.from({ length: 3 }, () => ({ detectorEvaluated: true, contextKey: "2v2:diamond-champion", opportunityCount: 2, fired: false })),
  ];
  assert.equal(longitudinalState({ evaluations, minimumMatches: 3 }).state, "context_specific");
});
