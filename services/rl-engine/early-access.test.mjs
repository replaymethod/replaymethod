import assert from "node:assert/strict";
import test from "node:test";
import { composeEarlyAccessOutput } from "./early-access.mjs";

const normalized = {
  subjectDisplayName: "Player",
  mode: "2v2",
  rank: "Champion II",
  gameVersion: "v2.70",
  occurredAt: "2026-08-22T12:00:00Z",
  metadata: {
    playerCount: 4,
    evidenceEngine: {
      frameState: { frameCount: 3000 },
      episodeTimeline: { rawEventCount: 400, decisionEventCount: 80 },
    },
  },
};

function run(detectorId, candidateCount, evidence, measurements = {}) {
  return { detectorId, detectorVersion: "0.2.0", status: candidateCount ? "observed" : "no_signal", candidateCount, evidence, measurements };
}

test("publishes only bounded experimental insights and preserves formal validation separation", () => {
  const output = composeEarlyAccessOutput({ runs: [run(
    "boost.supersonic_waste",
    3,
    [1, 2, 3].map((index) => ({ startFrame: index * 100, startTimeSeconds: index * 20, boostSpent: 3 })),
    { totalBoostSpent: 9 },
  )] }, normalized);
  assert.equal(output.formalValidationStatus, "not_validated");
  assert.equal(output.findings.length, 1);
  assert.equal(output.findings[0].publicationStatus, "experimental_early_access");
  assert.equal(output.findings[0].lifecycle, "shadow");
  assert.ok(output.findings[0].confidence >= 0.65 && output.findings[0].confidence < 0.8);
  assert.match(output.findings[0].limitations.join(" "), /not formally validated/i);
  assert.equal(output.verifiedFacts.subjectDisplayName, "Player");
});

test("abstains locally when a candidate lacks enough evidence", () => {
  const output = composeEarlyAccessOutput({ runs: [run(
    "boost.supersonic_waste",
    1,
    [{ startFrame: 100, startTimeSeconds: 20, boostSpent: 1 }],
    { totalBoostSpent: 1 },
  )] }, normalized);
  assert.equal(output.findings.length, 0);
  assert.deepEqual(output.assessments.map(item => item.status), ["abstained"]);
  assert.match(output.assessments[0].reason, /Fewer than 3/);
});

test("does not turn generic shadow observations into advice", () => {
  const output = composeEarlyAccessOutput({ runs: [run(
    "possession.first_touch",
    8,
    Array.from({ length: 8 }, (_, index) => ({ timeSeconds: index * 10 })),
  )] }, normalized);
  assert.equal(output.findings.length, 0);
  assert.match(output.assessments[0].reason, /does not yet have a bounded Early Access interpretation/);
});
