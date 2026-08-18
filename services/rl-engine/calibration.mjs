import { assessPublicDetectorGate } from "./quality-gates.mjs";
import { wilsonLowerBound } from "./quality-gates.mjs";

export const CALIBRATION_REPORT_VERSION = "rocket-league-calibration-report.v1";
export const REVIEW_QUEUE_VERSION = "rocket-league-review-queue.v1";

const reviewQuestions = Object.freeze({
  "boost.zero_duration": "Did zero boost materially reduce this player's useful options in this moment?",
  "boost.supersonic_waste": "Was boost spent without creating useful additional speed or positional value?",
  "kickoff.speed": "Was this kickoff arrival or contact meaningfully late for the spawn and approach?",
  "possession.first_touch": "Did this first touch give away a stronger controllable option?",
  "challenge.dive": "Was this commitment avoidable and did it create meaningful team risk?",
  "rotation.spacing_too_close": "Did this spacing duplicate a teammate's coverage or reduce reaction time?",
  "teamplay.double_commit": "Did both teammates commit to the same ball without enough layered coverage?",
  "recovery.momentum_loss": "Was this low-speed interval avoidable and did it delay useful re-entry?",
});

export function aggregateCalibrationRuns(entries, failures = []) {
  const detectors = new Map();
  for (const entry of entries) {
    for (const run of entry.shadowRuns ?? []) {
      const aggregate = detectors.get(run.detectorId) ?? {
        detectorId: run.detectorId,
        detectorVersion: run.detectorVersion,
        replayRuns: 0,
        executionErrors: 0,
        replaysWithSignal: 0,
        candidateCount: 0,
      };
      aggregate.replayRuns += 1;
      aggregate.executionErrors += run.status === "error" ? 1 : 0;
      aggregate.replaysWithSignal += run.status === "observed" ? 1 : 0;
      aggregate.candidateCount += run.candidateCount ?? 0;
      detectors.set(run.detectorId, aggregate);
    }
  }

  const modes = entries.reduce((counts, entry) => {
    const mode = entry.mode || "unknown";
    counts[mode] = (counts[mode] ?? 0) + 1;
    return counts;
  }, {});
  const detectorResults = [...detectors.values()].map((detector) => ({
    ...detector,
    signalReplayRate: detector.replayRuns ? detector.replaysWithSignal / detector.replayRuns : 0,
    publicQualityGate: assessPublicDetectorGate({ replayCount: detector.replayRuns }),
  }));

  return {
    schemaVersion: CALIBRATION_REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    corpus: {
      replayCount: entries.length,
      failureCount: failures.length,
      modes,
      totalSampledFrames: entries.reduce((sum, entry) => sum + (entry.sampledFrames ?? 0), 0),
      totalParserEvents: entries.reduce((sum, entry) => sum + (entry.parserEvents ?? 0), 0),
      totalDecisionEvents: entries.reduce((sum, entry) => sum + (entry.decisionEvents ?? 0), 0),
    },
    replays: entries,
    detectors: detectorResults,
    failures,
    conclusions: {
      parserCoverageEstablished: entries.length > 0 && failures.length === 0,
      publicDetectorsEnabled: detectorResults.filter((detector) => detector.publicQualityGate.eligible).length,
      nextGate: "Add timestamp-reviewed expert labels across representative rank and mode cohorts.",
    },
  };
}

export function buildReviewQueue(calibrationReport) {
  const candidates = [];
  for (const replay of calibrationReport?.replays ?? []) {
    for (const run of replay.shadowRuns ?? []) {
      for (const [index, evidence] of (run.evidence ?? []).entries()) {
        candidates.push({
          id: `${replay.replayFingerprint}:${run.detectorId}:${index + 1}`,
          replayFingerprint: replay.replayFingerprint,
          mode: replay.mode ?? null,
          gameVersion: replay.gameVersion ?? null,
          detectorId: run.detectorId,
          detectorVersion: run.detectorVersion,
          reviewQuestion: reviewQuestions[run.detectorId] ?? "Is this detector candidate correct and useful?",
          timestampSeconds: evidence.timeSeconds ?? evidence.startTimeSeconds ?? null,
          frame: evidence.frame ?? evidence.startFrame ?? null,
          observation: evidence,
          label: null,
          timestampVerified: null,
          notes: "",
        });
      }
    }
  }
  return {
    schemaVersion: REVIEW_QUEUE_VERSION,
    sourceReportVersion: calibrationReport?.schemaVersion ?? null,
    generatedAt: new Date().toISOString(),
    candidates,
  };
}

export function calibrationMetricsFromLabels(reviewQueue, detectorId) {
  const candidates = (reviewQueue?.candidates ?? []).filter((candidate) => candidate.detectorId === detectorId);
  const confirmed = candidates.filter((candidate) => candidate.label === "confirmed");
  const rejected = candidates.filter((candidate) => candidate.label === "rejected");
  const reviewed = [...confirmed, ...rejected];
  const timestampReviewed = reviewed.filter((candidate) => typeof candidate.timestampVerified === "boolean");
  return {
    replayCount: new Set(candidates.map((candidate) => candidate.replayFingerprint)).size,
    reviewedPositives: confirmed.length,
    reviewedNegatives: rejected.length,
    precision: reviewed.length ? confirmed.length / reviewed.length : null,
    precisionLowerBound: wilsonLowerBound(confirmed.length, reviewed.length),
    falsePositiveRate: reviewed.length ? rejected.length / reviewed.length : null,
    timestampVerifiedRate: timestampReviewed.length
      ? timestampReviewed.filter((candidate) => candidate.timestampVerified).length / timestampReviewed.length
      : null,
    rankModeCohorts: new Set(candidates.map((candidate) => candidate.mode).filter(Boolean)).size,
    expertLabelSetVersion: reviewQueue?.labelSetVersion ?? null,
    patchRegressionPassed: reviewQueue?.patchRegressionPassed === true,
    abstentionRuleTested: reviewQueue?.abstentionRuleTested === true,
  };
}
