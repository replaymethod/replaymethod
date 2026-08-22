import { assessPublicDetectorGate } from "./quality-gates.mjs";
import { wilsonLowerBound } from "./quality-gates.mjs";
import { createHash } from "node:crypto";

export const CALIBRATION_REPORT_VERSION = "rocket-league-calibration-report.v1";
export const REVIEW_QUEUE_VERSION = "rocket-league-review-queue.v2";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => !["generatedAt", "reproducibilityFingerprint"].includes(key))
      .map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function calibrationFingerprint(report) {
  const material = stableValue({
    ...report,
    replays: [...(report?.replays ?? [])].sort((left, right) => String(left.replayFingerprint).localeCompare(String(right.replayFingerprint))),
  });
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

function versionInventory(report) {
  const versions = new Set();
  for (const replay of report?.replays ?? []) {
    for (const [name, version] of Object.entries(replay.versions ?? {})) if (version) versions.add(`${name}:${version}`);
    for (const run of replay.shadowRuns ?? []) versions.add(`detector:${run.detectorId}@${run.detectorVersion}`);
    if (replay.gameVersion) versions.add(`game:${replay.gameVersion}`);
  }
  return [...versions].sort();
}

export function compareCalibrationReports(left, right) {
  const leftVersions = versionInventory(left);
  const rightVersions = versionInventory(right);
  return {
    reproducible: calibrationFingerprint(left) === calibrationFingerprint(right),
    versionDrift: JSON.stringify(leftVersions) !== JSON.stringify(rightVersions),
    leftVersions,
    rightVersions,
  };
}

const decidedVerdicts = new Set(["confirmed", "rejected"]);

export function reviewerAgreementMetrics(labels = []) {
  const latest = new Map();
  for (const label of labels) {
    const candidateKey = label.candidateKey ?? label.candidateId;
    const reviewer = String(label.reviewerId ?? label.reviewerEmail ?? "").trim().toLowerCase();
    if (!candidateKey || !reviewer || !decidedVerdicts.has(label.verdict)) continue;
    latest.set(`${candidateKey}:${reviewer}`, { ...label, candidateKey, reviewer });
  }
  const byCandidate = Map.groupBy([...latest.values()], (label) => label.candidateKey);
  const comparisons = [];
  for (const candidateLabels of byCandidate.values()) {
    for (let left = 0; left < candidateLabels.length; left += 1) {
      for (let right = left + 1; right < candidateLabels.length; right += 1) {
        comparisons.push([candidateLabels[left].verdict, candidateLabels[right].verdict]);
      }
    }
  }
  const rawAgreement = comparisons.length
    ? comparisons.filter(([left, right]) => left === right).length / comparisons.length
    : null;
  const decisions = [...latest.values()];
  const positiveRate = decisions.length
    ? decisions.filter((label) => label.verdict === "confirmed").length / decisions.length
    : null;
  const expected = positiveRate == null ? null : (positiveRate ** 2) + ((1 - positiveRate) ** 2);
  const kappa = rawAgreement == null || expected == null || expected === 1
    ? null
    : (rawAgreement - expected) / (1 - expected);
  return {
    independentReviewers: new Set(decisions.map((label) => label.reviewer)).size,
    doubleReviewedCandidates: [...byCandidate.values()].filter((items) => items.length >= 2).length,
    pairwiseComparisons: comparisons.length,
    rawAgreement,
    kappa,
  };
}

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
    const calibrationEligible = entry.evidenceSource === "real_replay";
    for (const run of entry.shadowRuns ?? []) {
      const applicable = run.status !== "not_applicable";
      const aggregate = detectors.get(run.detectorId) ?? {
        detectorId: run.detectorId,
        detectorVersion: run.detectorVersion,
        replayRuns: 0,
        executionErrors: 0,
        replaysWithSignal: 0,
        candidateCount: 0,
        ineligibleReplayRuns: 0,
        notApplicableRuns: 0,
      };
      aggregate.replayRuns += calibrationEligible && applicable ? 1 : 0;
      aggregate.ineligibleReplayRuns += !calibrationEligible && applicable ? 1 : 0;
      aggregate.notApplicableRuns += applicable ? 0 : 1;
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

  const report = {
    schemaVersion: CALIBRATION_REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    corpus: {
      replayCount: entries.length,
      calibrationEligibleReplayCount: entries.filter((entry) => entry.evidenceSource === "real_replay").length,
      failureCount: failures.length,
      modeMismatchCount: entries.filter((entry) => entry.modeMatchesManifest === false).length,
      attributionVerifiedCount: entries.filter((entry) => entry.attributionState === "verified").length,
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
  return { ...report, reproducibilityFingerprint: calibrationFingerprint(report) };
}

export function buildReviewQueue(calibrationReport) {
  const candidates = [];
  for (const replay of calibrationReport?.replays ?? []) {
    for (const run of replay.shadowRuns ?? []) {
      for (const [index, evidence] of (run.evidence ?? []).entries()) {
        candidates.push({
          id: `${replay.replayFingerprint}:${run.detectorId}@${run.detectorVersion}:${index + 1}`,
          replayFingerprint: replay.replayFingerprint,
          evidenceSource: replay.evidenceSource ?? "unknown",
          mode: replay.mode ?? null,
          rankCohort: replay.rankCohort ?? "unranked-unknown",
          cohortKey: replay.cohortKey ?? `${replay.mode ?? "unknown"}:${replay.rankCohort ?? "unranked-unknown"}`,
          metadataProvenance: replay.metadataProvenance ?? "unknown",
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

export function calibrationMetricsFromLabels(reviewQueue, detectorId, labelHistory = []) {
  const candidates = (reviewQueue?.candidates ?? []).filter((candidate) => (
    candidate.detectorId === detectorId && candidate.evidenceSource === "real_replay"
  ));
  const confirmed = candidates.filter((candidate) => candidate.label === "confirmed");
  const rejected = candidates.filter((candidate) => candidate.label === "rejected");
  const reviewed = [...confirmed, ...rejected];
  const timestampReviewed = reviewed.filter((candidate) => typeof candidate.timestampVerified === "boolean");
  const cohortCounts = candidates.reduce((counts, candidate) => {
    const key = candidate.cohortKey ?? `${candidate.mode ?? "unknown"}:${candidate.rankCohort ?? "unranked-unknown"}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const relevantHistory = labelHistory.filter((label) => !label.detectorId || label.detectorId === detectorId);
  const agreement = reviewerAgreementMetrics(relevantHistory);
  const decidedHistory = relevantHistory.filter((label) => decidedVerdicts.has(label.verdict));
  const coveredCohortCounts = Object.entries(cohortCounts)
    .filter(([key]) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown"))
    .map(([, count]) => count);
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
    rankModeCohorts: Object.keys(cohortCounts).filter((key) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown")).length,
    cohortCounts,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    independentReviewers: agreement.independentReviewers,
    reviewerAgreement: agreement.kappa,
    reviewerRawAgreement: agreement.rawAgreement,
    doubleReviewedCandidates: agreement.doubleReviewedCandidates,
    labelProvenanceComplete: decidedHistory.length > 0 && decidedHistory.every((label) => (
      (label.reviewerId || label.reviewerEmail)
      && label.reviewerQualification
      && label.labelSetVersion
      && label.createdAt
    )),
    expertLabelSetVersion: reviewQueue?.labelSetVersion ?? null,
    patchRegressionPassed: reviewQueue?.patchRegressionPassed === true,
    versionDriftPassed: reviewQueue?.versionDriftPassed === true,
    confidenceCalibrationPassed: reviewQueue?.confidenceCalibrationPassed === true,
    reproducibilityPassed: reviewQueue?.reproducibilityPassed === true,
    detectorDependenciesPassed: reviewQueue?.detectorDependenciesPassed === true,
    conflictResolutionTested: reviewQueue?.conflictResolutionTested === true,
    abstentionRuleTested: reviewQueue?.abstentionRuleTested === true,
  };
}
