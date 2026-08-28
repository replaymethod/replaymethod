import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBlindReviewDecision,
  finalizeBlindReviewPacket,
  reviewAt,
  reviewProgress,
  validateBlindReviewAssets,
} from "./blind-review-session.mjs";

function fixture() {
  const candidateId = "replay:detector@0.1.0:opportunity";
  const packet = {
    schemaVersion: "rocket-league-blind-reviewer-packet.v1",
    sourceReportFingerprint: "a".repeat(64),
    labelSetVersion: "labels.v1",
    labelManualFingerprint: "b".repeat(64),
    reviewerSlot: "reviewer-a",
    reviewer: { reviewerId: null, qualification: null, submittedAt: null },
    blindReview: true,
    candidateCount: 1,
    redactionPolicy: "model_decision_and_rationale_removed",
    rounds: [{ round: 1, reviews: [{
      candidateId,
      momentKey: candidateId,
      detectorId: "detector",
      detectorVersion: "0.1.0",
      reviewQuestion: "Question?",
      replayFingerprint: "replay",
      timestampSeconds: 1,
      frame: 1,
      mode: "2v2",
      rankCohort: "diamond-champion",
      label: { gameplayTruth: null, timestampVerified: null, contextCorrect: null, coachingRelevance: null, ambiguous: null, notes: "" },
    }] }],
  };
  const moments = {
    schemaVersion: "rocket-league-review-moments.v2",
    moments: { [candidateId]: { candidateKey: candidateId, roster: [], frames: [] } },
  };
  return { candidateId, packet, moments };
}

test("validates exact blind coverage and rejects model leakage", () => {
  const { packet, moments } = fixture();
  assert.equal(validateBlindReviewAssets(packet, moments).candidateCount, 1);
  assert.throws(() => validateBlindReviewAssets({ ...packet, classification: "hidden" }, moments), /forbidden model field/);
});

test("saves a complete decision and finalizes only complete packets", () => {
  const { candidateId, packet } = fixture();
  assert.throws(() => finalizeBlindReviewPacket(packet, { reviewerId: "r1", qualification: "GC" }), /incomplete/);
  const decided = applyBlindReviewDecision(packet, candidateId, {
    gameplayTruth: "uncertain",
    timestampVerified: true,
    contextCorrect: false,
    coachingRelevance: true,
    ambiguous: true,
    notes: "Team call is unavailable.",
  });
  assert.deepEqual(reviewProgress(decided), { complete: 1, total: 1, remaining: 0 });
  const final = finalizeBlindReviewPacket(decided, { reviewerId: "r1", qualification: "GC2 replay reviewer", submittedAt: "2026-08-27T00:00:00Z" });
  assert.equal(final.reviewer.reviewerId, "r1");
  assert.equal(packet.rounds[0].reviews[0].label.gameplayTruth, null);
});

test("retrieves only an assigned anonymized moment", () => {
  const { packet, moments } = fixture();
  assert.equal(reviewAt(packet, moments, 0).review.detectorId, "detector");
  assert.throws(() => reviewAt(packet, moments, 1), /out of range/);
});
