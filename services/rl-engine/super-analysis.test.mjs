import assert from "node:assert/strict";
import test from "node:test";
import { composeSuperAnalysis, SUPER_ANALYSIS_VERSION } from "./super-analysis.mjs";

function run(overrides = {}) {
  return {
    detectorId: "recovery.landing_orientation",
    detectorVersion: "0.1.0",
    status: "observed",
    candidateCount: 2,
    qualityGate: { eligible: false },
    evidence: [{ timeSeconds: 4, frame: 120, classification: "misaligned_landing_delayed_reentry", description: "Measured landing delay." }],
    ...overrides,
  };
}

test("keeps technical shadow evidence separate from customer coaching", () => {
  const output = composeSuperAnalysis({ runs: [run()] }, {
    schemaVersion: "mechanics@1",
    publicationStatus: "private_shadow",
    summary: { eligibleTouchEpisodes: 3, eligibleRecoveryEpisodes: 2, executionEventCounts: { wavedash: 1 }, surfaceFractions: { ground: 0.8 } },
  });
  assert.equal(output.schemaVersion, SUPER_ANALYSIS_VERSION);
  assert.equal(output.status, "quality_gate_blocked");
  assert.equal(output.primaryFocus, null);
  assert.equal(output.weeklyPlan.status, "withheld_until_quality_gate");
  assert.equal(output.privateReviewCandidates.length, 1);
  assert.equal(output.privateReviewCandidates[0].causalStatus, "kinematic_association_not_controller_input_attribution");
  assert.deepEqual(output.evidenceBoundaries.notObserved, ["controller_inputs", "camera_view", "communications", "intent", "fatigue", "motor_impairment"]);
});

test("emits a short remeasurement plan only after an explicit detector quality gate", () => {
  const output = composeSuperAnalysis({ runs: [run({ qualityGate: { eligible: true } })] }, { summary: {} });
  assert.equal(output.status, "ready");
  assert.equal(output.primaryFocus.detectorId, "recovery.landing_orientation");
  assert.equal(output.weeklyPlan.sessions.length, 3);
  assert.match(output.weeklyPlan.sessions[2].focus, /remeasure/i);
});

test("keeps root-cause chains as bounded temporal hypotheses", () => {
  const first = run({
    detectorId: "possession.control_space",
    opportunityContract: { evaluations: [{ status: "firing", timestampSeconds: 10, frame: 300, classification: "lost_control", contextKey: "2v2:touch" }] },
  });
  const second = run({
    detectorId: "recovery.landing_orientation",
    opportunityContract: { evaluations: [{ status: "firing", timestampSeconds: 12.5, frame: 375, classification: "slow_reentry", contextKey: "2v2:landing" }] },
  });
  const output = composeSuperAnalysis({ runs: [first, second] }, { summary: {} });
  assert.equal(output.privateRootCauseCandidates.length, 1);
  assert.equal(output.privateRootCauseCandidates[0].rootCauseStatus, "temporal_hypothesis_not_causal_proof");
  assert.equal(output.privateRootCauseCandidates[0].rootCandidate.timestampSeconds, 10);
  assert.match(output.privateRootCauseCandidates[0].limitation, /cannot prove/i);
});
