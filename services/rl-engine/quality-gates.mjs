export const PUBLIC_DETECTOR_GATE = Object.freeze({
  minimumReplays: 50,
  minimumReviewedPositives: 30,
  minimumReviewedNegatives: 30,
  minimumPrecision: 0.9,
  maximumFalsePositiveRate: 0.05,
  minimumTimestampVerifiedRate: 0.95,
  minimumRankModeCohorts: 3,
});

export function assessPublicDetectorGate(metrics = {}, gate = PUBLIC_DETECTOR_GATE) {
  const checks = [
    ["replay_coverage", (metrics.replayCount ?? 0) >= gate.minimumReplays],
    ["reviewed_positives", (metrics.reviewedPositives ?? 0) >= gate.minimumReviewedPositives],
    ["reviewed_negatives", (metrics.reviewedNegatives ?? 0) >= gate.minimumReviewedNegatives],
    ["precision", Number.isFinite(metrics.precision) && metrics.precision >= gate.minimumPrecision],
    ["false_positive_rate", Number.isFinite(metrics.falsePositiveRate) && metrics.falsePositiveRate <= gate.maximumFalsePositiveRate],
    ["timestamp_verification", Number.isFinite(metrics.timestampVerifiedRate)
      && metrics.timestampVerifiedRate >= gate.minimumTimestampVerifiedRate],
    ["rank_mode_cohorts", (metrics.rankModeCohorts ?? 0) >= gate.minimumRankModeCohorts],
    ["patch_regression", metrics.patchRegressionPassed === true],
    ["expert_labels", Boolean(metrics.expertLabelSetVersion)],
    ["abstention_rule", metrics.abstentionRuleTested === true],
  ].map(([id, passed]) => ({ id, passed }));

  return {
    eligible: checks.every((check) => check.passed),
    checks,
    blockedBy: checks.filter((check) => !check.passed).map((check) => check.id),
    gate,
  };
}
