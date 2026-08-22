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
  timestampVerified?: boolean | null;
  gameplayTruth?: string | null;
  contextCorrect?: boolean | null;
  coachingRelevance?: string | null;
  createdAt: string;
};

const qualifiedReviewerContexts = new Set(["competitive_player", "rocket_league_coach", "replay_analyst"]);

function playlistScopeQualifies(value: string | null | undefined, mode: string | null | undefined) {
  if (!mode) return false;
  try {
    const scopes = JSON.parse(value || "{}") as Record<string, unknown>;
    const scope = scopes[mode];
    if (typeof scope === "string") return scope !== "unverified";
    if (!scope || typeof scope !== "object") return false;
    const ranks = scope as Record<string, unknown>;
    return typeof ranks.currentRank === "string" && ranks.currentRank !== "unverified"
      && typeof ranks.highestRank === "string" && ranks.highestRank !== "unverified";
  } catch {
    return false;
  }
}

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
    const playlistQualified = playlistScopeQualifies(label.reviewerScopeJson, candidate?.mode);
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
  const agreement = reviewerAgreementMetrics(qualifiedHistory);
  const cohortCounts = decided.reduce<Record<string, number>>((counts, item) => {
    const row = item.row;
    const key = row.mode && row.rankCohort ? `${row.mode}:${row.rankCohort}` : "unknown:unranked-unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const coveredCohortCounts = Object.entries(cohortCounts)
    .filter(([key]) => !key.startsWith("unknown:") && !key.endsWith(":unranked-unknown"))
    .map(([, count]) => count);
  const metrics = {
    replayCount: new Set(decided.map((item) => item.row.replayFingerprint)).size,
    reviewedPositives: confirmed,
    reviewedNegatives: rejected,
    precision: decided.length ? confirmed / decided.length : null,
    precisionLowerBound: wilsonLowerBound(confirmed, decided.length),
    falsePositiveRate: decided.length ? rejected / decided.length : null,
    timestampVerifiedRate: decided.length
      ? decided.filter((item) => item.decisions.every(label => label.timestampVerified === true)).length / decided.length
      : null,
    rankModeCohorts: coveredCohortCounts.length,
    minimumCohortSamples: coveredCohortCounts.length ? Math.min(...coveredCohortCounts) : 0,
    independentReviewers: agreement.independentReviewers,
    reviewerAgreement: agreement.rawAgreement,
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

export function reviewerOperationsSummary(rows: ReviewRow[], labelHistory: ReviewLabelRow[] = []) {
  const candidateById = new Map(rows.map(row => [row.id, row]));
  const eligible = labelHistory.filter(label => {
    const candidate = candidateById.get(label.candidateId);
    return Boolean(candidate)
      && label.reviewerId != null
      && qualifiedReviewerContexts.has(label.reviewerQualification)
      && label.labelSetVersion === RL_LABEL_SET_VERSION
      && playlistScopeQualifies(label.reviewerScopeJson, candidate?.mode);
  });
  const latest = new Map<string, ReviewLabelRow>();
  for (const label of eligible) {
    const key = `${label.candidateId}:${label.reviewerId}`;
    const prior = latest.get(key);
    if (!prior || label.createdAt >= prior.createdAt) latest.set(key, label);
  }
  const labels = [...latest.values()];
  const byCandidate = Map.groupBy(labels, label => label.candidateId);
  const states = rows.map(row => {
    const candidateLabels = byCandidate.get(row.id) ?? [];
    const decided = candidateLabels.filter(label => label.verdict === "confirmed" || label.verdict === "rejected");
    const uncertain = candidateLabels.some(label => label.verdict === "uncertain");
    const disagreement = decided.length >= 2 && new Set(decided.map(label => label.verdict)).size > 1;
    const consensus = decided.length >= 2 && !uncertain && !disagreement && decided.every(label => label.verdict === decided[0].verdict)
      ? decided[0].verdict
      : null;
    return { row, labels: candidateLabels, decided, uncertain, disagreement, consensus };
  });
  const agreement = reviewerAgreementMetrics(labels.map(label => ({ ...label, candidateKey: candidateById.get(label.candidateId)?.candidateKey })));
  const cohorts = Object.values(Object.groupBy(states, item => `${item.row.mode ?? "unknown"}:${item.row.rankCohort ?? "unranked-unknown"}`)).map(items => {
    const group = items ?? [];
    const key = group.length ? `${group[0].row.mode ?? "unknown"}:${group[0].row.rankCohort ?? "unranked-unknown"}` : "unknown:unranked-unknown";
    return {
      cohort: key,
      candidates: group.length,
      doubleReviewed: group.filter(item => item.labels.length >= 2).length,
      confirmed: group.filter(item => item.consensus === "confirmed").length,
      rejected: group.filter(item => item.consensus === "rejected").length,
      unresolved: group.filter(item => item.labels.length >= 2 && item.consensus == null).length,
    };
  }).sort((left, right) => left.cohort.localeCompare(right.cohort));
  return {
    candidates: rows.length,
    qualifiedLabels: labels.length,
    independentReviewers: agreement.independentReviewers,
    doubleReviewed: states.filter(item => item.labels.length >= 2).length,
    agreement: agreement.rawAgreement,
    confirmed: states.filter(item => item.consensus === "confirmed").length,
    rejected: states.filter(item => item.consensus === "rejected").length,
    falsePositives: states.filter(item => item.consensus === "rejected").length,
    unresolved: states.filter(item => item.labels.length >= 2 && item.consensus == null).length,
    timestampVerifiedLabels: labels.filter(label => label.timestampVerified === true).length,
    timestampDenominator: labels.length,
    cohorts,
    exclusions: {
      insufficientIndependentLabels: states.filter(item => item.labels.length < 2).length,
      uncertain: states.filter(item => item.uncertain).length,
      oneToOneDisagreement: states.filter(item => item.disagreement && item.decided.length === 2).length,
      unqualifiedOrWrongVersionLabels: labelHistory.length - eligible.length,
    },
  };
}

export function percentage(value: number | null, digits = 0) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}
