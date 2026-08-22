import { assessPublicDetectorGate, wilsonLowerBound } from "../services/rl-engine/quality-gates.mjs";
import { reviewerAgreementMetrics } from "../services/rl-engine/calibration.mjs";
import { RL_LABEL_SET_VERSION } from "./rl-review";

type ReviewRow = {
  id: number;
  candidateKey: string;
  detectorId: string;
  replayFingerprint: string;
  mode: string | null;
  rankCohort?: string | null;
  verdict: string;
  timestampVerified: boolean | null;
  reviewerEmail?: string | null;
  reviewerQualification?: string | null;
  labelSetVersion?: string | null;
  reviewedAt?: string | null;
};

type ReviewLabelRow = {
  id?: number;
  candidateId: number;
  reviewerId?: number | null;
  reviewerEmail: string;
  reviewerQualification: string;
  reviewerScopeJson?: string | null;
  verdict: string;
  labelSetVersion: string;
  createdAt: string;
};

const qualifiedReviewerContexts = new Set(["competitive_player", "rocket_league_coach", "replay_analyst"]);

const gateLabels: Record<string, string> = {
  replay_coverage: "50 representative replays",
  reviewed_positives: "30 confirmed examples",
  reviewed_negatives: "30 rejected examples",
  precision: "90% raw precision",
  precision_lower_bound: "85% conservative confidence floor",
  false_positive_rate: "5% maximum false positives",
  timestamp_verification: "95% verified timestamps",
  rank_mode_cohorts: "3 rank/mode cohorts",
  patch_regression: "Patch regression suite",
  expert_labels: "Versioned expert labels",
  abstention_rule: "Abstention tests",
  cohort_sample_floor: "5 examples in every covered cohort",
  independent_reviewers: "2 independent reviewers",
  reviewer_agreement: "60% reviewer agreement floor",
  label_provenance: "Complete label provenance",
  version_drift: "Parser and patch drift checks",
  confidence_calibration: "Confidence calibration check",
  deterministic_reproducibility: "Deterministic reproduction check",
  detector_dependencies: "Detector dependency checks",
  conflict_resolution: "Conflict and duplicate-resolution tests",
};

export function detectorQualitySummary(rows: ReviewRow[], labelHistory: ReviewLabelRow[] = []) {
  const candidateById = new Map(rows.map(row => [row.id, row]));
  const qualifiedHistoryAll = labelHistory.filter(label => {
    const candidate = candidateById.get(label.candidateId);
    let scopes: Record<string, unknown> = {};
    try { scopes = JSON.parse(label.reviewerScopeJson || "{}"); } catch { /* invalid scope never qualifies */ }
    const playlistQualified = Boolean(candidate?.mode && typeof scopes[candidate.mode] === "string" && scopes[candidate.mode] !== "unverified");
    return candidate && playlistQualified && label.reviewerId != null && qualifiedReviewerContexts.has(label.reviewerQualification) && label.labelSetVersion === RL_LABEL_SET_VERSION;
  }).map(label => ({
    ...label,
    candidateKey: candidateById.get(label.candidateId)!.candidateKey,
    detectorId: candidateById.get(label.candidateId)!.detectorId
  }));
  const latestByReviewerCandidate = new Map<string, typeof qualifiedHistoryAll[number]>();
  for (const label of qualifiedHistoryAll) {
    const key = `${label.candidateId}:${label.reviewerId}`;
    const previous = latestByReviewerCandidate.get(key);
    if (!previous || label.createdAt >= previous.createdAt) latestByReviewerCandidate.set(key, label);
  }
  const qualifiedHistory = [...latestByReviewerCandidate.values()];
  const labelsByCandidate = qualifiedHistory.reduce<Map<number, typeof qualifiedHistory>>((map, label) => {
    const labels = map.get(label.candidateId) ?? [];
    labels.push(label);
    map.set(label.candidateId, labels);
    return map;
  }, new Map());
  const consensus = rows.map(row => {
    const labels = labelsByCandidate.get(row.id) ?? [];
    const decisions = labels.filter(label => label.verdict === "confirmed" || label.verdict === "rejected");
    const verdict = decisions.length >= 2 && decisions.every(label => label.verdict === decisions[0].verdict) ? decisions[0].verdict : null;
    return { row, labels, decisions, verdict };
  });
  const decided = consensus.filter(item => item.verdict != null);
  const confirmed = decided.filter(item => item.verdict === "confirmed").length;
  const rejected = decided.filter(item => item.verdict === "rejected").length;
  const timestampReviewed = decided.filter(item => item.decisions.every(label => label.timestampVerified != null));
  const agreement = reviewerAgreementMetrics(qualifiedHistory);
  const cohortCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const key = row.mode && row.rankCohort ? `${row.mode}:${row.rankCohort}` : "unknown:unranked-unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const coveredCohortCounts = Object.entries(cohortCounts)
    .filter(([key]) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown"))
    .map(([, count]) => count);
  const metrics = {
    replayCount: new Set(rows.map((row) => row.replayFingerprint)).size,
    reviewedPositives: confirmed,
    reviewedNegatives: rejected,
    precision: decided.length ? confirmed / decided.length : null,
    precisionLowerBound: wilsonLowerBound(confirmed, decided.length),
    falsePositiveRate: decided.length ? rejected / decided.length : null,
    timestampVerifiedRate: timestampReviewed.length
      ? timestampReviewed.filter((item) => item.decisions.every(label => label.timestampVerified === true)).length / timestampReviewed.length
      : null,
    rankModeCohorts: coveredCohortCounts.length,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    independentReviewers: agreement.independentReviewers,
    reviewerAgreement: agreement.kappa,
    reviewerRawAgreement: agreement.rawAgreement,
    doubleReviewedCandidates: agreement.doubleReviewedCandidates,
    labelProvenanceComplete: decided.length > 0 && decided.every(item => item.decisions.length >= 2 && new Set(item.decisions.map(label => label.reviewerId)).size >= 2),
    patchRegressionPassed: false,
    versionDriftPassed: false,
    confidenceCalibrationPassed: false,
    reproducibilityPassed: false,
    detectorDependenciesPassed: false,
    conflictResolutionTested: false,
    expertLabelSetVersion: qualifiedHistory.length ? RL_LABEL_SET_VERSION : null,
    abstentionRuleTested: false,
  };
  const gate = assessPublicDetectorGate(metrics);
  return {
    total: rows.length,
    reviewed: consensus.filter((item) => item.labels.length > 0).length,
    uncertain: consensus.filter((item) => item.labels.some(label => label.verdict === "uncertain") || (item.decisions.length >= 2 && item.verdict == null)).length,
    ...metrics,
    gate: {
      eligible: gate.eligible,
      checks: gate.checks.map((check) => ({
        id: String(check.id),
        passed: check.passed === true,
        label: gateLabels[String(check.id)] ?? String(check.id),
      })),
      blockedBy: gate.blockedBy,
    },
  };
}

export function percentage(value: number | null, digits = 0) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}
