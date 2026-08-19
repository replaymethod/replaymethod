import assert from "node:assert/strict";
import test from "node:test";
import { composeCoachReport } from "./coaching.mjs";

test("abstains when no deterministic finding has passed the quality gate", () => {
  const report = composeCoachReport([{ detectorId: "challenge.dive", qualityGate: { eligible: false } }], { mode: "2v2" });
  assert.equal(report.status, "insufficient_evidence");
  assert.equal(report.public, false);
});

test("chooses one primary focus and limits supporting observations", () => {
  const findings = [
    { detectorId: "challenge.dive", detectorVersion: "1", confidence: 0.94, recurrence: 0.8, impact: 0.9, trainability: 0.9, sampleSize: 4, evidence: [1, 2, 3, 4], qualityGate: { eligible: true }, activation: { valid: true } },
    { detectorId: "boost.zero_duration", detectorVersion: "1", confidence: 0.92, recurrence: 0.6, impact: 0.6, sampleSize: 4, evidence: [1], qualityGate: { eligible: true }, activation: { valid: true } },
    { detectorId: "possession.first_touch", detectorVersion: "1", confidence: 0.91, recurrence: 0.5, impact: 0.5, sampleSize: 4, evidence: [1], qualityGate: { eligible: true }, activation: { valid: true } },
    { detectorId: "kickoff.speed", detectorVersion: "1", confidence: 0.9, recurrence: 0.3, impact: 0.3, sampleSize: 6, evidence: [1], qualityGate: { eligible: true }, activation: { valid: true } },
  ];
  const report = composeCoachReport(findings, { subject: "Player", mode: "Ranked Doubles", rank: "Champion II", enabledDetectorIds: findings.map((finding) => finding.detectorId) });
  assert.equal(report.status, "ready");
  assert.equal(report.primaryFocus.detectorId, "challenge.dive");
  assert.equal(report.primaryFocus.evidence.length, 3);
  assert.equal(report.supportingObservations.length, 2);
  assert.match(report.primaryFocus.queueRule, /fake|shadow|force/i);
  assert.match(report.primaryFocus.returnToPlay, /queue/i);
  assert.ok(report.primaryFocus.interventionFailureEvidence);
});
