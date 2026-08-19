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

/**
 * Classify a focus across comparable detector evaluations. A missing firing is
 * usable only when the detector explicitly evaluated enough eligible
 * opportunities in the same context. Otherwise the result stays insufficient.
 */
export function longitudinalState(input = {}) {
  const evaluations = (input.evaluations ?? []).filter((item) => item?.detectorEvaluated === true);
  const comparable = evaluations.filter((item) => !input.contextKey || item.contextKey === input.contextKey);
  const minimumMatches = Number.isInteger(input.minimumMatches) ? Math.max(2, input.minimumMatches) : 3;
  const minimumOpportunities = Number.isInteger(input.minimumOpportunities) ? Math.max(1, input.minimumOpportunities) : 3;
  const opportunities = comparable.reduce((sum, item) => sum + (Number.isInteger(item.opportunityCount) ? item.opportunityCount : 0), 0);
  if (comparable.length < minimumMatches || opportunities < minimumOpportunities) {
    return { state: "insufficient_sample", comparableMatches: comparable.length, opportunities };
  }

  const values = comparable.map((item) => item.metricValue).filter(Number.isFinite);
  if (Number.isFinite(input.target) && values.length) {
    const latest = values.at(-1);
    if (input.direction === "decrease" && latest <= input.target) return { state: "resolved", comparableMatches: comparable.length, opportunities };
    if (input.direction === "increase" && latest >= input.target) return { state: "resolved", comparableMatches: comparable.length, opportunities };
  }

  const firingRate = comparable.filter((item) => item.fired === true).length / comparable.length;
  if (firingRate === 0 && input.absenceCanProveResolution === true) {
    return { state: "resolved", comparableMatches: comparable.length, opportunities };
  }
  if (values.length >= minimumMatches && Number.isFinite(input.baseline)) {
    const latest = values.at(-1);
    if (input.direction === "decrease") {
      if (latest < input.baseline) return { state: "improving", comparableMatches: comparable.length, opportunities };
      if (latest > input.baseline) return { state: "regressing", comparableMatches: comparable.length, opportunities };
    }
    if (input.direction === "increase") {
      if (latest > input.baseline) return { state: "improving", comparableMatches: comparable.length, opportunities };
      if (latest < input.baseline) return { state: "regressing", comparableMatches: comparable.length, opportunities };
    }
  }
  const contexts = new Set(evaluations.map((item) => item.contextKey).filter(Boolean));
  const contextRates = Map.groupBy(evaluations, (item) => item.contextKey ?? "unknown");
  const materiallyDifferentContext = contexts.size > 1 && [...contextRates.values()].some((items) => (
    items.length >= minimumMatches && items.filter((item) => item.fired === true).length / items.length >= 0.67
  )) && [...contextRates.values()].some((items) => (
    items.length >= minimumMatches && items.filter((item) => item.fired === true).length / items.length <= 0.33
  ));
  if (materiallyDifferentContext) return { state: "context_specific", comparableMatches: comparable.length, opportunities };
  return { state: "recurring", comparableMatches: comparable.length, opportunities };
}
