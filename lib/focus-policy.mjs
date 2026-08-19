const directions = new Set(["increase", "decrease", "maintain"]);

export function supportedFocusFinding(finding) {
  return Boolean(
    finding
    && typeof finding.id === "string"
    && finding.id.length > 0
    && Number.isFinite(finding.confidence)
    && finding.confidence > 0
    && finding.confidenceLabel !== "insufficient"
    && Array.isArray(finding.evidence)
    && finding.evidence.length > 0
    && finding.recommendation?.queueRule,
  );
}

export function explicitProgressMetric(finding) {
  const key = finding?.recommendation?.progressMetricKey;
  if (!key || typeof key !== "string") return null;
  const metric = (finding.metrics || []).find(candidate => candidate.key === key && Number.isFinite(candidate.value));
  if (!metric) return null;

  const direction = directions.has(finding.recommendation.targetDirection)
    ? finding.recommendation.targetDirection
    : null;
  const target = Number.isFinite(finding.recommendation.targetValue)
    && direction
    && (finding.recommendation.targetUnit || null) === (metric.unit || null)
    ? finding.recommendation.targetValue
    : null;
  const minimumMatches = Number.isInteger(finding.recommendation.matchesToObserve)
    ? Math.min(50, Math.max(1, finding.recommendation.matchesToObserve))
    : 3;
  return {
    key: metric.key,
    label: metric.label,
    value: metric.value,
    unit: metric.unit || null,
    target,
    direction: target == null ? null : direction,
    minimumMatches,
  };
}

export function progressState({ baseline, latest, target, direction, matchesObserved, minimumMatches }) {
  if (!Number.isFinite(baseline) || !Number.isFinite(latest)) return "evidence_only";
  if (matchesObserved < minimumMatches) return "collecting";
  if (Number.isFinite(target) && direction === "decrease" && latest <= target) return "target_met";
  if (Number.isFinite(target) && direction === "increase" && latest >= target) return "target_met";
  if (direction === "decrease") return latest < baseline ? "improving" : latest > baseline ? "regressing" : "unchanged";
  if (direction === "increase") return latest > baseline ? "improving" : latest < baseline ? "regressing" : "unchanged";
  return direction === "maintain" ? "observing" : "evidence_only";
}
