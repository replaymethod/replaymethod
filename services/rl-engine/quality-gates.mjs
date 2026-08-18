export const PUBLIC_DETECTOR_GATE = Object.freeze({
  minimumReplays: 50,
  minimumReviewedPositives: 30,
  minimumReviewedNegatives: 30,
  minimumPrecision: 0.9,
  minimumPrecisionLowerBound: 0.85,
  maximumFalsePositiveRate: 0.05,
  minimumTimestampVerifiedRate: 0.95,
  minimumRankModeCohorts: 3,
});

/** Conservative 95% Wilson lower bound for a binomial acceptance rate. */
export function wilsonLowerBound(successes, total, z = 1.96) {
  if (!Number.isFinite(successes) || !Number.isFinite(total) || total <= 0 || successes < 0 || successes > total) return null;
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = proportion + (z * z) / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + (z * z) / (4 * total)) / total);
  return (center - margin) / denominator;
}

export function assessPublicDetectorGate(metrics = {}, gate = PUBLIC_DETECTOR_GATE) {
  const checks = [
    ["replay_coverage", (metrics.replayCount ?? 0) >= gate.minimumReplays],
    ["reviewed_positives", (metrics.reviewedPositives ?? 0) >= gate.minimumReviewedPositives],
    ["reviewed_negatives", (metrics.reviewedNegatives ?? 0) >= gate.minimumReviewedNegatives],
    ["precision", Number.isFinite(metrics.precision) && metrics.precision >= gate.minimumPrecision],
    ["precision_lower_bound", Number.isFinite(metrics.precisionLowerBound)
      && metrics.precisionLowerBound >= gate.minimumPrecisionLowerBound],
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
