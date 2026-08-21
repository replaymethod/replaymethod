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
  candidateId: number;
  reviewerEmail: string;
  reviewerQualification: string;
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
  const decided = rows.filter((row) => row.verdict === "confirmed" || row.verdict === "rejected");
  const confirmed = decided.filter((row) => row.verdict === "confirmed").length;
  const rejected = decided.filter((row) => row.verdict === "rejected").length;
  const timestampReviewed = decided.filter((row) => row.timestampVerified != null);
  const candidateById = new Map(rows.map(row => [row.id, row]));
  const qualifiedHistory = labelHistory.filter(label => {
    const candidate = candidateById.get(label.candidateId);
    return candidate && qualifiedReviewerContexts.has(label.reviewerQualification) && label.labelSetVersion === RL_LABEL_SET_VERSION;
  }).map(label => ({
    ...label,
    candidateKey: candidateById.get(label.candidateId)!.candidateKey,
    detectorId: candidateById.get(label.candidateId)!.detectorId
  }));
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
      ? timestampReviewed.filter((row) => row.timestampVerified).length / timestampReviewed.length
      : null,
    rankModeCohorts: coveredCohortCounts.length,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    independentReviewers: agreement.independentReviewers,
    reviewerAgreement: agreement.kappa,
    reviewerRawAgreement: agreement.rawAgreement,
    doubleReviewedCandidates: agreement.doubleReviewedCandidates,
    labelProvenanceComplete: decided.length > 0 && decided.every(row => qualifiedHistory.some(label => (
      label.candidateId === row.id && (label.verdict === "confirmed" || label.verdict === "rejected")
    ))),
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
    reviewed: rows.filter((row) => row.verdict !== "unreviewed").length,
    uncertain: rows.filter((row) => row.verdict === "uncertain").length,
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
