import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  aggregateCalibrationRuns,
  buildReviewQueue,
  calibrationMetricsFromLabels,
  reviewerAgreementMetrics,
  calibrationFingerprint,
  compareCalibrationReports,
  buildOpportunityReviewQueue,
  opportunityMetricsFromLabels,
  reviewerAgreementByStratum,
  buildAdjudicationQueue,
  buildIndependentReviewPlan,
  buildBlindReviewerPackets,
  mergeBlindReviewerSubmissions,
  finalizeBlindReviewAdjudication,
} from "./calibration.mjs";

const TEST_LABEL_MANUAL_FINGERPRINT = "a".repeat(64);

test("aggregates replay coverage while keeping public quality gates closed", () => {
  const report = aggregateCalibrationRuns([
    {
      mode: "Ranked Doubles", sampledFrames: 100, parserEvents: 200, decisionEvents: 40, evidenceSource: "real_replay",
      rankCohort: "diamond-champion", cohortKey: "2v2:diamond-champion", metadataProvenance: "corpus-manifest",
      replayFingerprint: "replay-a",
      shadowRuns: [{ detectorId: "boost.zero_duration", detectorVersion: "0.1.0", status: "observed", candidateCount: 3, evidence: [{ startTimeSeconds: 12, startFrame: 120 }] }],
    },
    {
      mode: "Ranked Doubles", sampledFrames: 120, parserEvents: 240, decisionEvents: 50, evidenceSource: "real_replay",
      replayFingerprint: "replay-b",
      shadowRuns: [{ detectorId: "boost.zero_duration", detectorVersion: "0.1.0", status: "no_signal", candidateCount: 0, evidence: [] }],
    },
  ]);

  assert.equal(report.corpus.replayCount, 2);
  assert.equal(report.corpus.calibrationEligibleReplayCount, 2);
  assert.match(report.reproducibilityFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.corpus.totalSampledFrames, 220);
  assert.equal(report.corpus.modes["Ranked Doubles"], 2);
  assert.equal(report.detectors[0].replayRuns, 2);
  assert.equal(report.detectors[0].candidateCount, 3);
  assert.equal(report.detectors[0].signalReplayRate, 0.5);
  assert.equal(report.detectors[0].publicQualityGate.eligible, false);
  assert.equal(report.conclusions.publicDetectorsEnabled, 0);

  const queue = buildReviewQueue(report);
  assert.equal(queue.candidates.length, 1);
  assert.equal(queue.schemaVersion, "rocket-league-review-queue.v2");
  assert.equal(queue.candidates[0].id, "replay-a:boost.zero_duration@0.1.0:1");
  assert.equal(queue.candidates[0].timestampSeconds, 12);
  assert.equal(queue.candidates[0].rankCohort, "diamond-champion");
  assert.equal(queue.candidates[0].label, null);
  queue.candidates[0].label = "confirmed";
  queue.candidates[0].timestampVerified = true;
  queue.labelSetVersion = "test-labels@1";
  const metrics = calibrationMetricsFromLabels(queue, "boost.zero_duration");
  assert.equal(metrics.reviewedPositives, 1);
  assert.equal(metrics.candidateConfirmationRate, 1);
  assert.equal(metrics.precision, null);
  assert.equal(metrics.timestampVerifiedRate, 1);
});

test("quality metrics count only decided examples and treat missing timestamp review as a failure", () => {
  const queue = {
    labelSetVersion: "test-labels@1",
    candidates: [
      { replayFingerprint: "reviewed-a", detectorId: "kickoff.speed", evidenceSource: "real_replay", mode: "1v1", rankCohort: "gold-platinum", cohortKey: "1v1:gold-platinum", label: "confirmed", timestampVerified: true },
      { replayFingerprint: "reviewed-b", detectorId: "kickoff.speed", evidenceSource: "real_replay", mode: "2v2", rankCohort: "diamond-champion", cohortKey: "2v2:diamond-champion", label: "rejected", timestampVerified: null },
      { replayFingerprint: "unreviewed", detectorId: "kickoff.speed", evidenceSource: "real_replay", mode: "3v3", rankCohort: "grand-champion-ssl", cohortKey: "3v3:grand-champion-ssl", label: null, timestampVerified: null },
    ],
  };
  const metrics = calibrationMetricsFromLabels(queue, "kickoff.speed");
  assert.equal(metrics.replayCount, 2);
  assert.equal(metrics.rankModeCohorts, 2);
  assert.deepEqual(metrics.cohortCounts, { "1v1:gold-platinum": 1, "2v2:diamond-champion": 1 });
  assert.equal(metrics.timestampVerifiedRate, 0.5);
});

test("synthetic fixtures cannot count as calibration evidence", () => {
  const fixture = { replayFingerprint: "fixture", evidenceSource: "synthetic_fixture", shadowRuns: [{ detectorId: "test", detectorVersion: "1", status: "observed", candidateCount: 1 }] };
  const report = aggregateCalibrationRuns([fixture]);
  assert.equal(report.corpus.replayCount, 1);
  assert.equal(report.corpus.calibrationEligibleReplayCount, 0);
  assert.equal(report.detectors[0].replayRuns, 0);
  assert.equal(report.detectors[0].ineligibleReplayRuns, 1);
});

test("does not count a mode-inapplicable detector as an execution", () => {
  const report = aggregateCalibrationRuns([{
    replayFingerprint: "ones",
    evidenceSource: "real_replay",
    mode: "1v1",
    shadowRuns: [{ detectorId: "teamplay.double_commit", detectorVersion: "0.1.0", status: "not_applicable", candidateCount: 0 }],
  }]);
  assert.equal(report.detectors[0].replayRuns, 0);
  assert.equal(report.detectors[0].notApplicableRuns, 1);
});

test("reproducibility ignores timestamps but detects source or version drift", () => {
  const base = { schemaVersion: "test", generatedAt: "one", replays: [{ replayFingerprint: "a", evidenceSource: "real_replay", versions: { parser: "1" }, shadowRuns: [] }] };
  const same = { ...base, generatedAt: "two" };
  assert.equal(calibrationFingerprint(base), calibrationFingerprint(same));
  assert.equal(compareCalibrationReports(base, same).reproducible, true);
  const operationallyDifferent = { ...same, operational: { totalRuntimeMs: 123 }, replays: [{ ...same.replays[0], operational: { runtimeMs: 42 } }] };
  assert.equal(compareCalibrationReports(base, operationallyDifferent).reproducible, true);
  const drifted = { ...same, replays: [{ ...same.replays[0], versions: { parser: "2" } }] };
  assert.equal(compareCalibrationReports(base, drifted).versionDrift, true);
  assert.equal(compareCalibrationReports(base, drifted).reproducible, false);
});

test("reports independent reviewer agreement without counting repeat edits twice", () => {
  const labels = [
    { candidateKey: "a", reviewerEmail: "one@example.com", verdict: "confirmed" },
    { candidateKey: "a", reviewerEmail: "two@example.com", verdict: "confirmed" },
    { candidateKey: "b", reviewerEmail: "one@example.com", verdict: "confirmed" },
    { candidateKey: "b", reviewerEmail: "two@example.com", verdict: "rejected" },
    { candidateKey: "b", reviewerEmail: "two@example.com", verdict: "confirmed" },
  ];
  const agreement = reviewerAgreementMetrics(labels);
  assert.equal(agreement.independentReviewers, 2);
  assert.equal(agreement.doubleReviewedCandidates, 2);
  assert.equal(agreement.pairwiseComparisons, 2);
  assert.equal(agreement.rawAgreement, 1);
});

test("reports reviewer agreement per detector context and isolates adjudication", () => {
  const queue = {
    schemaVersion: "opportunity-queue@1",
    sourceReportFingerprint: "fingerprint",
    candidates: [
      { id: "a", detectorId: "challenge.quality", detectorVersion: "1", opportunityStatus: "firing", opportunityContextKey: "2v2:last", timestampSeconds: 10, replayFingerprint: "r1" },
      { id: "b", detectorId: "challenge.quality", detectorVersion: "1", opportunityStatus: "non_firing", opportunityContextKey: "2v2:first", timestampSeconds: 20, replayFingerprint: "r2" },
    ],
  };
  const labels = [
    { candidateKey: "a", detectorId: "challenge.quality", contextKey: "2v2:last", reviewerId: 1, verdict: "confirmed", createdAt: "2026-01-01" },
    { candidateKey: "a", detectorId: "challenge.quality", contextKey: "2v2:last", reviewerId: 2, verdict: "rejected", createdAt: "2026-01-01" },
    { candidateKey: "b", detectorId: "challenge.quality", contextKey: "2v2:first", reviewerId: 1, verdict: "uncertain", createdAt: "2026-01-01" },
    { candidateKey: "b", detectorId: "challenge.quality", contextKey: "2v2:first", reviewerId: 2, verdict: "confirmed", createdAt: "2026-01-01" },
  ];
  const strata = reviewerAgreementByStratum(labels);
  assert.equal(strata.length, 2);
  assert.equal(strata.find((item) => item.contextKey === "2v2:last").rawAgreement, 0);
  const adjudication = buildAdjudicationQueue(queue, labels);
  assert.equal(adjudication.unresolvedCount, 2);
  assert.deepEqual(adjudication.candidates.map((candidate) => candidate.reason), ["ambiguous_or_uncertain", "reviewer_disagreement"]);
  assert.ok(adjudication.candidates.every((candidate) => candidate.adjudication === null));
});

test("builds two blind reviewer plans over the exact same candidate set", () => {
  const queue = {
    schemaVersion: "queue@1",
    sourceReportFingerprint: "fingerprint",
    labelSetVersion: "labels@1",
    candidates: Array.from({ length: 9 }, (_, index) => ({ id: `candidate-${index + 1}` })),
  };
  const plan = buildIndependentReviewPlan(queue, { rounds: 3, labelManualFingerprint: TEST_LABEL_MANUAL_FINGERPRINT });
  assert.equal(plan.reviewerCount, 2);
  assert.equal(plan.candidatesPerReviewer, 9);
  assert.equal(plan.totalIndependentDecisionsRequired, 18);
  assert.equal(plan.identicalCandidateCoverage, true);
  const sets = plan.assignments.map((assignment) => new Set(assignment.rounds.flatMap((round) => round.candidateIds)));
  assert.deepEqual(sets[0], sets[1]);
  assert.notDeepEqual(plan.assignments[0].rounds, plan.assignments[1].rounds);
});

test("exports reviewer packets without leaking model decisions", () => {
  const candidates = Array.from({ length: 6 }, (_, index) => ({
    id: `candidate-${index + 1}`,
    detectorId: "challenge.quality",
    detectorVersion: "0.3.0",
    reviewQuestion: "Was the challenge justified?",
    replayFingerprint: `replay-${index}`,
    timestampSeconds: index + 1,
    frame: index * 10,
    mode: "2v2",
    rankCohort: "diamond-champion",
    opportunityStatus: index % 2 ? "firing" : "non_firing",
    observation: { classification: "model_answer", reasons: ["hidden"] },
  }));
  const queue = { schemaVersion: "queue@1", sourceReportFingerprint: "fingerprint", labelSetVersion: "labels@1", candidates };
  const plan = buildIndependentReviewPlan(queue, { rounds: 2, labelManualFingerprint: TEST_LABEL_MANUAL_FINGERPRINT });
  const moments = { candidateCount: candidates.length, moments: Object.fromEntries(candidates.map((candidate) => [candidate.id, { frames: [] }])) };
  const packets = buildBlindReviewerPackets(queue, plan, moments);
  assert.equal(packets.length, 2);
  assert.ok(packets.every((packet) => packet.candidateCount === candidates.length));
  const serialized = JSON.stringify(packets);
  assert.doesNotMatch(serialized, /model_answer|non_firing|opportunityStatus/);
  assert.notDeepEqual(packets[0].rounds, packets[1].rounds);
  assert.ok(packets.flatMap((packet) => packet.rounds).flatMap((round) => round.reviews)
    .every((review) => review.label.gameplayTruth === null && review.momentKey === review.candidateId));
});

function completedPacket(packet, reviewerId, truthByCandidate) {
  return {
    ...structuredClone(packet),
    reviewer: {
      reviewerId,
      qualification: "GC3 replay analyst with 500 reviewed matches",
      submittedAt: "2026-08-27T12:00:00.000Z",
    },
    rounds: packet.rounds.map((round) => ({
      ...round,
      reviews: round.reviews.map((review) => ({
        ...review,
        label: {
          gameplayTruth: truthByCandidate[review.candidateId],
          timestampVerified: true,
          contextCorrect: true,
          coachingRelevance: true,
          ambiguous: truthByCandidate[review.candidateId] === "uncertain",
          notes: truthByCandidate[review.candidateId] === "uncertain" ? "Reachability is outside the retained window." : "",
        },
      })),
    })),
  };
}

test("merges complete blind reviews, derives model outcomes and isolates adjudication", () => {
  const candidates = [
    { id: "fire", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r1", timestampSeconds: 1, frame: 10, mode: "2v2", rankCohort: "gc", opportunityStatus: "firing", opportunityContextKey: "2v2:first" },
    { id: "quiet", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r2", timestampSeconds: 2, frame: 20, mode: "2v2", rankCohort: "gc", opportunityStatus: "non_firing", opportunityContextKey: "2v2:last" },
    { id: "abstain", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r3", timestampSeconds: 3, frame: 30, mode: "2v2", rankCohort: "gc", opportunityStatus: "abstained", opportunityContextKey: "2v2:unknown" },
  ];
  const queue = {
    schemaVersion: "queue@1", sourceReportFingerprint: "fingerprint", labelSetVersion: "labels@1",
    blindReview: true, holdoutIncluded: false, candidates,
  };
  const plan = buildIndependentReviewPlan(queue, { rounds: 2, labelManualFingerprint: TEST_LABEL_MANUAL_FINGERPRINT });
  const moments = { candidateCount: candidates.length, moments: Object.fromEntries(candidates.map((candidate) => [candidate.id, {}])) };
  const packets = buildBlindReviewerPackets(queue, plan, moments);
  const submissions = [
    completedPacket(packets[0], "reviewer-one", { fire: "present", quiet: "present", abstain: "uncertain" }),
    completedPacket(packets[1], "reviewer-two", { fire: "present", quiet: "absent", abstain: "uncertain" }),
  ];
  const merged = mergeBlindReviewerSubmissions(queue, submissions);
  assert.equal(merged.reviewerCount, 2);
  assert.equal(merged.independentDecisionCount, 6);
  assert.equal(merged.resolvedConsensusCount, 1);
  assert.equal(merged.unresolvedAdjudicationCount, 2);
  assert.equal(merged.resolvedQueue.candidates[0].modelOutcome, "true_positive");
  assert.equal(merged.detectorMetrics["challenge.quality"].truePositives, 1);
  assert.equal(merged.detectorMetrics["challenge.quality"].falsePositives, 0);
  assert.deepEqual(new Set(merged.adjudicationQueue.candidates.map((candidate) => candidate.reason)), new Set([
    "reviewer_disagreement", "ambiguous_or_uncertain",
  ]));
  assert.equal(merged.reviewerAgreement.rawAgreement, 2 / 3);
});

test("blind review merge fails closed on leaked model fields and reviewer reuse", () => {
  const candidate = { id: "one", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r1", timestampSeconds: 1, frame: 10, mode: "2v2", rankCohort: "gc", opportunityStatus: "firing", opportunityContextKey: "ctx" };
  const queue = { schemaVersion: "queue@1", sourceReportFingerprint: "fingerprint", labelSetVersion: "labels@1", blindReview: true, holdoutIncluded: false, candidates: [candidate] };
  const plan = buildIndependentReviewPlan(queue, { labelManualFingerprint: TEST_LABEL_MANUAL_FINGERPRINT });
  const packets = buildBlindReviewerPackets(queue, plan, { candidateCount: 1, moments: { one: {} } });
  const first = completedPacket(packets[0], "same-reviewer", { one: "present" });
  const second = completedPacket(packets[1], "same-reviewer", { one: "present" });
  assert.throws(() => mergeBlindReviewerSubmissions(queue, [first, second]), /identities must be unique/);
  second.reviewer.reviewerId = "other-reviewer";
  second.rounds[0].reviews[0].opportunityStatus = "firing";
  assert.throws(() => mergeBlindReviewerSubmissions(queue, [first, second]), /forbidden fields: opportunityStatus/);
  delete second.rounds[0].reviews[0].opportunityStatus;
  second.rounds[0].reviews[0].label.gameplayTruth = null;
  assert.throws(() => mergeBlindReviewerSubmissions(queue, [first, second]), /incomplete gameplayTruth/);
});

test("finalizes redacted adjudication without rewriting source reviews", () => {
  const candidates = [
    { id: "consensus", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r1", timestampSeconds: 1, frame: 10, mode: "2v2", rankCohort: "gc", opportunityStatus: "firing", opportunityContextKey: "first" },
    { id: "disputed", detectorId: "challenge.quality", detectorVersion: "0.3.0", reviewQuestion: "Question", replayFingerprint: "r2", timestampSeconds: 2, frame: 20, mode: "2v2", rankCohort: "gc", opportunityStatus: "non_firing", opportunityContextKey: "last" },
  ];
  const queue = { schemaVersion: "queue@1", sourceReportFingerprint: "fingerprint", labelSetVersion: "labels@1", blindReview: true, holdoutIncluded: false, candidates };
  const plan = buildIndependentReviewPlan(queue, { rounds: 2, labelManualFingerprint: TEST_LABEL_MANUAL_FINGERPRINT });
  const packets = buildBlindReviewerPackets(queue, plan, { candidateCount: 2, moments: { consensus: {}, disputed: {} } });
  const merge = mergeBlindReviewerSubmissions(queue, [
    completedPacket(packets[0], "reviewer-one", { consensus: "present", disputed: "present" }),
    completedPacket(packets[1], "reviewer-two", { consensus: "present", disputed: "absent" }),
  ]);
  const adjudication = structuredClone(merge.adjudicationQueue);
  adjudication.adjudicator = { adjudicatorId: "reviewer-three", qualification: "SSL coach", submittedAt: "2026-08-28T12:00:00.000Z" };
  adjudication.candidates[0].adjudication = {
    gameplayTruth: "present", timestampVerified: true, contextCorrect: true,
    coachingRelevance: true, ambiguous: false, rationale: "The retained replay window resolves first access.",
  };
  assert.doesNotMatch(JSON.stringify(adjudication), /opportunityStatus|true_positive|false_negative/);
  const finalized = finalizeBlindReviewAdjudication(queue, merge, adjudication);
  assert.equal(finalized.consensusCount, 1);
  assert.equal(finalized.adjudicatedCount, 1);
  assert.equal(finalized.unresolvedUncertainCount, 0);
  assert.equal(finalized.finalQueue.candidates.length, 2);
  assert.equal(finalized.detectorMetrics["challenge.quality"].truePositives, 1);
  assert.equal(finalized.detectorMetrics["challenge.quality"].falseNegatives, 1);
  assert.equal(finalized.finalQueue.candidates.find((candidate) => candidate.id === "disputed").resolution, "adjudicated");
  adjudication.adjudicator.adjudicatorId = "reviewer-one";
  assert.throws(() => finalizeBlindReviewAdjudication(queue, merge, adjudication), /independent/);
});

test("builds a separate opportunity queue with firing, non-firing and abstention review", () => {
  const evaluations = [
    { opportunityId: "one", timestampSeconds: 10, frame: 100, status: "firing", classification: "opponent_gain", contextKey: "2v2:first:low" },
    { opportunityId: "two", timestampSeconds: 20, frame: 200, status: "non_firing", classification: "team_retained", contextKey: "2v2:first:low" },
    { opportunityId: "three", timestampSeconds: 30, frame: 300, status: "abstained", classification: "outcome_unresolved", contextKey: "2v2:first:high" },
  ];
  const report = {
    schemaVersion: "test-report",
    reproducibilityFingerprint: "fingerprint",
    replays: [{
      replayFingerprint: "1234567890abcdef", evidenceSource: "real_replay", mode: "2v2", rankCohort: "diamond-champion",
      cohortKey: "2v2:diamond-champion", corpusAssignment: "calibration_dev", subjectRosterIndex: 2,
      attributionState: "verified", modeMatchesManifest: true,
      opportunityContracts: [{ detectorId: "possession.first_touch_retention", detectorVersion: "0.1.0", opportunityType: "first_touch_retention", evaluations }],
    }],
  };
  const queue = buildOpportunityReviewQueue(report, { perStatus: 2 });
  assert.equal(queue.schemaVersion, "rocket-league-opportunity-review-queue.v1");
  assert.equal(queue.candidates.length, 3);
  assert.deepEqual(new Set(queue.candidates.map((candidate) => candidate.opportunityStatus)), new Set(["firing", "non_firing", "abstained"]));
  assert.ok(queue.candidates.every((candidate) => candidate.label === null && candidate.subjectRosterIndex === 2));
  assert.equal(queue.holdoutIncluded, false);
});

test("opportunity sampling balances mode and rank cohorts before contexts", () => {
  const cohort = (fingerprint, mode, rankCohort) => ({
    replayFingerprint: fingerprint, evidenceSource: "real_replay", mode, rankCohort,
    cohortKey: `${mode}:${rankCohort}`, corpusAssignment: "calibration_dev", subjectRosterIndex: 0,
    attributionState: "verified", modeMatchesManifest: true,
    opportunityContracts: [{
      detectorId: "boost.overfill", detectorVersion: "0.3.0", opportunityType: "boost_overfill",
      evaluations: Array.from({ length: 5 }, (_, index) => ({
        opportunityId: `${fingerprint}-${index}`, timestampSeconds: index + 1, frame: index * 10,
        status: "firing", classification: "overfill", contextKey: "same-context",
      })),
    }],
  });
  const report = {
    schemaVersion: "test-report", reproducibilityFingerprint: "fingerprint",
    replays: [
      cohort("one-one-one-one", "1v1", "gold-platinum"),
      cohort("two-two-two-two", "2v2", "diamond-champion"),
      cohort("three-three-three", "3v3", "grand-champion-ssl"),
    ],
  };
  const queue = buildOpportunityReviewQueue(report, { detectorIds: ["boost.overfill"], perStatus: 3, maxPerReplay: 2 });
  assert.deepEqual(new Set(queue.candidates.map((candidate) => candidate.mode)), new Set(["1v1", "2v2", "3v3"]));
  assert.match(queue.selection.strategy, /mode\/rank cohorts/);
});

test("opportunity metrics expose false negatives instead of using candidate count as denominator", () => {
  const queue = { candidates: [
    { detectorId: "challenge.quality", opportunityStatus: "firing", gameplayTruth: "present" },
    { detectorId: "challenge.quality", opportunityStatus: "firing", gameplayTruth: "absent" },
    { detectorId: "challenge.quality", opportunityStatus: "non_firing", gameplayTruth: "present" },
    { detectorId: "challenge.quality", opportunityStatus: "non_firing", gameplayTruth: "absent" },
    { detectorId: "challenge.quality", opportunityStatus: "abstained", gameplayTruth: "uncertain" },
    { detectorId: "challenge.quality", opportunityStatus: "abstained", gameplayTruth: "present" },
  ] };
  const metrics = opportunityMetricsFromLabels(queue, "challenge.quality");
  assert.equal(metrics.truePositives, 1);
  assert.equal(metrics.falsePositives, 1);
  assert.equal(metrics.falseNegatives, 1);
  assert.equal(metrics.trueNegatives, 1);
  assert.equal(metrics.precision, 0.5);
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.falsePositiveRate, 0.5);
  assert.equal(metrics.scoredOpportunities, 4);
  assert.equal(metrics.reviewedPositives, 2);
  assert.equal(metrics.uncertainReviewed, 1);
  assert.equal(metrics.uncertainRate, 1 / 6);
  assert.ok(metrics.precision95.lower < metrics.precision && metrics.precision95.upper > metrics.precision);
  assert.equal(metrics.abstentionUncertainRate, 0.5);
});

test("opportunity queue fails closed when a protected split is present", () => {
  assert.throws(() => buildOpportunityReviewQueue({ reproducibilityFingerprint: "x", replays: [{ corpusAssignment: "frozen_blind_holdout" }] }), /only explicit calibration_dev/);
  assert.throws(() => buildOpportunityReviewQueue({ reproducibilityFingerprint: "x", replays: [{ corpusAssignment: null }] }), /only explicit calibration_dev/);
  assert.throws(() => buildOpportunityReviewQueue({ reproducibilityFingerprint: "x", replays: [{ corpusAssignment: "calibration_dev", evidenceSource: "synthetic_fixture", attributionState: "verified", replayFingerprint: "a" }] }), /real_replay/);
});

test("checked-in review queue is unique, private and ready for expert labeling", async () => {
  const queue = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_QUEUE.json", import.meta.url), "utf8"));
  assert.equal(queue.schemaVersion, "rocket-league-review-queue.v2");
  assert.equal(queue.candidates.length, 515);
  assert.equal(new Set(queue.candidates.map(candidate => candidate.id)).size, queue.candidates.length);
  assert.deepEqual(new Set(queue.candidates.map(candidate => candidate.detectorId)), new Set([
    "boost.zero_duration",
    "boost.supersonic_waste",
    "kickoff.speed",
    "possession.first_touch",
    "challenge.dive",
    "rotation.spacing_too_close",
    "teamplay.double_commit",
    "recovery.momentum_loss",
  ]));
  assert.ok(queue.candidates.every(candidate => candidate.label === null));
  assert.ok(queue.candidates.every(candidate => candidate.replayFingerprint && candidate.reviewQuestion));
  assert.ok(queue.candidates.every(candidate => candidate.id.includes(`@${candidate.detectorVersion}:`)));
});

test("checked-in replay moments cover every candidate without player identifiers", async () => {
  const queue = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_QUEUE.json", import.meta.url), "utf8"));
  const artifact = JSON.parse(await readFile(new URL("../../docs/RL_REVIEW_MOMENTS.json", import.meta.url), "utf8"));
  assert.equal(artifact.schemaVersion, "rocket-league-review-moments.v2");
  assert.equal(artifact.replayCount, 6);
  assert.equal(artifact.candidateCount, queue.candidates.length);
  assert.equal(artifact.missingCandidateCount, 0);
  assert.deepEqual(artifact.missingReplays, []);
  for (const candidate of queue.candidates) {
    const moment = artifact.moments[candidate.id];
    assert.ok(moment, `missing moment ${candidate.id}`);
    assert.ok(moment.frames.length >= 10);
    assert.ok(moment.roster.every((player) => /^P\d+$/.test(player.id)));
    assert.equal(moment.roster.filter((player) => player.subject).length, 1);
  }
});
