export type GameId = "rocket-league" | "league" | "valorant";
export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient";
export type Severity = "critical" | "high" | "medium" | "low";
export type FindingLifecycle = "candidate" | "calibrating" | "shadow" | "enabled" | "demoted";
export type AbstentionCode =
  | "insufficient_evidence"
  | "insufficient_sample"
  | "unsupported_mode"
  | "unsupported_context"
  | "identity_unresolved"
  | "parser_coverage_low"
  | "detector_not_enabled"
  | "detector_dependency_missing"
  | "detector_conflict"
  | "version_drift"
  | "quality_regression"
  | "public_output_disabled";

export type FindingContext = {
  schemaVersion: "rocket-league-context.v1" | "game-context.v1";
  mode: string;
  rankCohort: string;
  playerRole?: string;
  matchPhase?: string;
  pressure?: string;
  possession?: string;
  gameVersion?: string | null;
};

export type FindingProvenance = {
  inputFingerprint: string;
  parserVersion: string;
  normalizerVersion: string;
  detectorId: string;
  detectorVersion: string;
  registryVersion: string;
  executionId: string;
  producedAt: string;
};

export type EvidenceItem = {
  id: string;
  description: string;
  timestampSeconds?: number;
  round?: number;
  event?: string;
  metric?: string;
  value?: number | string;
  unit?: string;
};

export type MetricItem = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  baseline?: number;
  baselineSource?: string;
};

export type Recommendation = {
  queueRule: string;
  practiceSteps: string[];
  behaviorToChange?: string;
  whyItMatters?: string;
  cue?: string;
  dosage?: string;
  successCriterion?: string;
  doNotFocusOn?: string;
  returnToPlay?: string;
  laterEvidence?: string;
  interventionFailureEvidence?: string;
  successMetric?: string;
  targetValue?: number;
  targetUnit?: string;
  progressMetricKey?: string;
  targetDirection?: "increase" | "decrease" | "maintain";
  matchesToObserve?: number;
};

export type StructuredFinding = {
  id: string;
  category: string;
  title: string;
  summary: string;
  severity: Severity;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  frequency?: number;
  estimatedImpact?: string;
  impactScore?: number;
  trainabilityScore?: number;
  contextRelevance?: number;
  novelty?: "new" | "recurring" | "regressing" | "resolving";
  sampleSize?: number;
  lifecycle?: FindingLifecycle;
  context?: FindingContext;
  provenance?: FindingProvenance;
  abstentionCode?: AbstentionCode;
  evidence: EvidenceItem[];
  metrics: MetricItem[];
  recommendation: Recommendation;
  limitations: string[];
  detectorVersion: string;
  schemaVersion: "finding.v1";
};

export type NormalizedMatch = {
  schemaVersion: "game-data.v1";
  game: GameId;
  source: string;
  externalMatchId?: string;
  subjectPlayerId?: string;
  subjectDisplayName?: string;
  mode?: string;
  rank?: string;
  gameVersion?: string;
  occurredAt?: string;
  metadata: Record<string, unknown>;
  derivedMetrics: MetricItem[];
  limitations: string[];
};

export type AnalyzerVersions = {
  parser: string;
  normalizer: string;
  analyzer: string;
  detector: string;
  coaching: string;
  schema: "coaching.v1";
};

export type AdapterSuccess = {
  kind: "success";
  normalized: NormalizedMatch;
  findings: StructuredFinding[];
  versions: AnalyzerVersions;
  estimatedCostMicros: number;
};

export type AdapterBlocked = {
  kind: "blocked";
  code: string;
  publicMessage: string;
  internalMessage: string;
  retryable: boolean;
};

export type AdapterResult = AdapterSuccess | AdapterBlocked;

export type CoachingReport = {
  primaryFindingId: string;
  highestImpactMistake: string;
  whyItCosts: string;
  evidenceMoments: string[];
  nextQueueRule: string;
  practicePlan: string[];
  coachNote: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  limitations: string[];
};

export function assertFinding(value: StructuredFinding): StructuredFinding {
  if (!value.id || !value.title || !value.summary || !value.detectorVersion) {
    throw new Error("Analyzer returned an incomplete finding.");
  }
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new Error("Analyzer returned confidence outside the 0–1 range.");
  }
  if (!value.evidence.length) throw new Error("Analyzer returned a finding without evidence.");
  if (!value.recommendation.queueRule || !value.recommendation.practiceSteps.length) {
    throw new Error("Analyzer returned a finding without an actionable recommendation.");
  }
  if (value.lifecycle && value.lifecycle !== "enabled") {
    throw new Error("Analyzer returned a public finding from a detector that is not enabled.");
  }
  if (value.lifecycle === "enabled" && (!value.provenance || !value.context || !Number.isInteger(value.sampleSize) || value.sampleSize < 1)) {
    throw new Error("Enabled detector finding is missing context, sample size or provenance.");
  }
  if (value.provenance) {
    if (value.provenance.detectorId !== value.id || value.provenance.detectorVersion !== value.detectorVersion) {
      throw new Error("Analyzer returned mismatched detector provenance.");
    }
    if (!value.provenance.inputFingerprint || !value.provenance.parserVersion || !value.provenance.normalizerVersion
      || !value.provenance.registryVersion || !value.provenance.executionId || !value.provenance.producedAt) {
      throw new Error("Analyzer returned incomplete finding provenance.");
    }
  }
  return value;
}

export function deterministicReport(findings: StructuredFinding[]): CoachingReport {
  const ranked = findings.map(assertFinding).sort((a, b) => {
    const severity = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    const score = (finding: StructuredFinding) => (
      severity[finding.severity] * finding.confidence
      + (finding.impactScore ?? 0) * 0.8
      + (finding.trainabilityScore ?? 0) * 0.4
      + (finding.contextRelevance ?? 0) * 0.3
      + Math.min(1, Math.max(0, finding.frequency ?? 0)) * 0.5
    );
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
  const primary = ranked[0];
  if (!primary || primary.confidenceLabel === "insufficient") {
    throw new Error("No sufficiently supported coaching finding was produced.");
  }
  return {
    primaryFindingId: primary.id,
    highestImpactMistake: primary.title,
    whyItCosts: primary.summary,
    evidenceMoments: primary.evidence.slice(0, 5).map(item => item.description),
    nextQueueRule: primary.recommendation.queueRule,
    practicePlan: primary.recommendation.practiceSteps.slice(0, 5),
    coachNote: primary.limitations.length
      ? `Evidence limit: ${primary.limitations.join(" ")}`
      : "Replay Method will measure this same pattern in your next matches before changing your focus.",
    confidence: primary.confidence,
    confidenceLabel: primary.confidenceLabel,
    limitations: primary.limitations
  };
}
