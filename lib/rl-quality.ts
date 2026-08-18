import { assessPublicDetectorGate, wilsonLowerBound } from "../services/rl-engine/quality-gates.mjs";
import { RL_LABEL_SET_VERSION } from "./rl-review";

type ReviewRow = {
  detectorId: string;
  replayFingerprint: string;
  mode: string | null;
  verdict: string;
  timestampVerified: boolean | null;
};

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
};

export function detectorQualitySummary(rows: ReviewRow[]) {
  const decided = rows.filter((row) => row.verdict === "confirmed" || row.verdict === "rejected");
  const confirmed = decided.filter((row) => row.verdict === "confirmed").length;
  const rejected = decided.filter((row) => row.verdict === "rejected").length;
  const timestampReviewed = decided.filter((row) => row.timestampVerified != null);
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
    rankModeCohorts: new Set(rows.map((row) => row.mode).filter(Boolean)).size,
    patchRegressionPassed: false,
    expertLabelSetVersion: decided.length ? RL_LABEL_SET_VERSION : null,
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
      checks: gate.checks.map((check: { id: string; passed: boolean }) => ({
        ...check,
        label: gateLabels[check.id] ?? check.id,
      })),
      blockedBy: gate.blockedBy,
    },
  };
}

export function percentage(value: number | null, digits = 0) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}
