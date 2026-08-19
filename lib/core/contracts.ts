export type GameId = "rocket-league" | "league" | "valorant";
export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient";
export type Severity = "critical" | "high" | "medium" | "low";

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
  return value;
}

export function deterministicReport(findings: StructuredFinding[]): CoachingReport {
  const ranked = findings.map(assertFinding).sort((a, b) => {
    const severity = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    return (severity[b.severity] * b.confidence) - (severity[a.severity] * a.confidence);
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
