import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { analysisFindings, analysisJobs, analysisRequests, matches } from "../db/schema";
import { gameLabels, isAnalysisGame, parseLines, publicIdPattern } from "./analysis";
import { decodePlayerResolutionContext } from "./player-resolution.mjs";
import { canonicalUtcTimestamp } from "./report-date.mjs";

type EvidenceDetail = {
  label: string;
  description: string;
  timestamp?: number | null;
  round?: number | null;
};

export type PerformanceMetric = {
  id: string;
  category: string;
  label: string;
  displayValue: string;
  value: number;
  unit: string;
  status: "strong" | "neutral" | "review" | "insufficient_evidence";
  kind: "verified_fact" | "verified_telemetry" | "derived_metric";
  whatHappened: string;
  whyItMatters: string;
  limitation: string;
  source: string;
  version: string;
  sampleCount: number | null;
};

export type PerformanceMoment = {
  id: string;
  title: string;
  context: string;
  observation: string;
  consequence: string;
  betterAlternative: string | null;
  limitation: string;
  timestampSeconds: number;
  gameClockSeconds: number | null;
  frameStart: number | null;
  frameEnd: number | null;
  evidenceKind: "verified_telemetry" | "derived_metric";
  source: string;
  version: string;
};

export type PublicReportData = {
  publicId: string;
  game: string;
  gameLabel: string;
  currentRank: string;
  targetRank: string | null;
  status: string;
  createdAt: string;
  readyAt: string | null;
  processing: null | {
    jobPublicId: string;
    status: string;
    stage: string;
    stageLabel: string;
    attempts: number;
    errorCode: string | null;
    durationMs: number | null;
    estimatedCostMicros: number;
    nextRetryAt: string | null;
    updatedAt: string;
    candidatePlayers: string[];
    replayContext: {
      mode: string | null;
      gameVersion: string | null;
      occurredAt: string | null;
    };
    versions: {
      parser: string | null;
      analyzer: string | null;
      detector: string | null;
      coaching: string | null;
      schema: string;
    };
  };
  report: null | {
    highestImpactMistake: string | null;
    whyItCosts: string | null;
    evidenceMoments: string[];
    evidenceDetails: EvidenceDetail[];
    nextQueueRule: string | null;
    practicePlan: string[];
    coachNote: string | null;
    confidence: number | null;
    confidenceLabel: string | null;
    limitations: string[];
    analysisSource: "automated" | "quality_review" | "experimental_early_access";
  };
  verifiedFacts: null | {
    subjectDisplayName: string | null;
    mode: string | null;
    rank: string | null;
    gameVersion: string | null;
    occurredAt: string | null;
    playerCount: number | null;
    sampledFrames: number | null;
    parserEvents: number | null;
    decisionEvents: number | null;
    parserVersion: string | null;
    rankProvenance: "verified_replay" | "player_submitted" | "unknown";
  };
  performance: null | {
    version: string;
    match: {
      teamScore: number | null;
      opponentScore: number | null;
      result: "win" | "loss" | "draw" | "unknown";
      overtime: boolean;
      durationSeconds: number | null;
    };
    sample: {
      liveFrameCount: number;
      liveSeconds: number;
      frameCoverage: { ball: number | null; players: number | null };
    };
    strength: null | { title: string; detail: string; kind: "verified_fact" | "verified_telemetry"; limitation: string };
    metrics: PerformanceMetric[];
    moments: PerformanceMoment[];
  };
  batch: null | {
    version: string;
    validMatches: number;
    targetMatches: number;
    excludedFiles: number;
    playlist: string | null;
    confidence: string;
    oneOffDetectorCount: number;
    record: { wins: number; losses: number; draws: number; unknown: number };
    recurrence: { detectorId: string; matches: number; averageConfidence: number }[];
  };
  earlyAccess: null | {
    badge: "EARLY ACCESS BETA";
    heading: "Built from your real replay. Refined through expert validation.";
    body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard.";
    coachingStatus: "experimental_insight" | "abstained";
    formalValidationStatus: "not_validated";
    policyVersion: string | null;
    assessments: { detectorId: string; status: "experimental_insight" | "abstained"; reason: string }[];
    analysisCoverage: null | {
      totalDetectors: number;
      measuringDetectors: number;
      capabilityAbstained: number;
      publicEligible: number;
      categories: { id: string; label: string; total: number; measuring: number; capabilityAbstained: number; observed: number }[];
    };
  };
  feedbackScore: number | null;
};

function parseArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseEvidence(value: string | null | undefined): EvidenceDetail[] {
  return parseArray(value).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const description = typeof row.description === "string" ? row.description : "";
    if (!description) return [];
    return [{
      label: typeof row.label === "string" ? row.label : "Match evidence",
      description,
      timestamp: typeof row.timestamp === "number" ? row.timestamp : null,
      round: typeof row.round === "number" ? row.round : null
    }];
  }).slice(0, 5);
}

function parseLimitations(value: string | null | undefined): string[] {
  return parseArray(value).filter((item): item is string => typeof item === "string").slice(0, 8);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePerformanceMetric(value: unknown): PerformanceMetric | null {
  const row = objectValue(value);
  const status = ["strong", "neutral", "review", "insufficient_evidence"].includes(String(row.status))
    ? row.status as PerformanceMetric["status"] : null;
  const kind = ["verified_fact", "verified_telemetry", "derived_metric"].includes(String(row.kind))
    ? row.kind as PerformanceMetric["kind"] : null;
  const fields = ["id", "category", "label", "displayValue", "unit", "whatHappened", "whyItMatters", "limitation", "source", "version"]
    .map(key => nullableString(row[key]));
  const number = nullableNumber(row.value);
  if (fields.some(field => !field) || number === null || !status || !kind) return null;
  return {
    id: fields[0]!, category: fields[1]!, label: fields[2]!, displayValue: fields[3]!, value: number,
    unit: fields[4]!, status, kind, whatHappened: fields[5]!, whyItMatters: fields[6]!,
    limitation: fields[7]!, source: fields[8]!, version: fields[9]!, sampleCount: nullableNumber(row.sampleCount),
  };
}

function parsePerformanceMoment(value: unknown): PerformanceMoment | null {
  const row = objectValue(value);
  const evidenceKind = ["verified_telemetry", "derived_metric"].includes(String(row.evidenceKind))
    ? row.evidenceKind as PerformanceMoment["evidenceKind"] : null;
  const fields = ["id", "title", "context", "observation", "consequence", "limitation", "source", "version"]
    .map(key => nullableString(row[key]));
  const timestampSeconds = nullableNumber(row.timestampSeconds);
  if (fields.some(field => !field) || timestampSeconds === null || !evidenceKind) return null;
  return {
    id: fields[0]!, title: fields[1]!, context: fields[2]!, observation: fields[3]!, consequence: fields[4]!,
    betterAlternative: nullableString(row.betterAlternative), limitation: fields[5]!, timestampSeconds,
    gameClockSeconds: nullableNumber(row.gameClockSeconds), frameStart: nullableNumber(row.frameStart),
    frameEnd: nullableNumber(row.frameEnd), evidenceKind, source: fields[6]!, version: fields[7]!,
  };
}

function parsePerformance(value: unknown): PublicReportData["performance"] {
  const row = objectValue(value);
  const version = nullableString(row.version);
  const match = objectValue(row.match);
  const sample = objectValue(row.sample);
  const coverage = objectValue(sample.frameCoverage);
  const result = ["win", "loss", "draw", "unknown"].includes(String(match.result))
    ? match.result as "win" | "loss" | "draw" | "unknown" : "unknown";
  const metrics = (Array.isArray(row.metrics) ? row.metrics : []).map(parsePerformanceMetric).filter((item): item is PerformanceMetric => Boolean(item)).slice(0, 12);
  const moments = (Array.isArray(row.moments) ? row.moments : []).map(parsePerformanceMoment).filter((item): item is PerformanceMoment => Boolean(item)).slice(0, 5);
  if (!version || metrics.length < 5 || new Set(metrics.map(metric => metric.category)).size < 3) return null;
  const rawStrength = objectValue(row.strength);
  const strengthKind = ["verified_fact", "verified_telemetry"].includes(String(rawStrength.kind))
    ? rawStrength.kind as "verified_fact" | "verified_telemetry" : null;
  const strength = nullableString(rawStrength.title) && nullableString(rawStrength.detail) && nullableString(rawStrength.limitation) && strengthKind
    ? { title: String(rawStrength.title), detail: String(rawStrength.detail), limitation: String(rawStrength.limitation), kind: strengthKind }
    : null;
  return {
    version,
    match: {
      teamScore: nullableNumber(match.teamScore), opponentScore: nullableNumber(match.opponentScore), result,
      overtime: match.overtime === true, durationSeconds: nullableNumber(match.durationSeconds),
    },
    sample: {
      liveFrameCount: nullableNumber(sample.liveFrameCount) ?? 0,
      liveSeconds: nullableNumber(sample.liveSeconds) ?? 0,
      frameCoverage: { ball: nullableNumber(coverage.ball), players: nullableNumber(coverage.players) },
    },
    strength,
    metrics,
    moments,
  };
}

export async function loadPublicReport(publicId: string, options: { earlyAccessOutputEnabled?: boolean } = {}): Promise<PublicReportData | null> {
  if (!publicIdPattern.test(publicId)) return null;
  const db = await getDb();
  const row = await db.select().from(analysisRequests).where(eq(analysisRequests.publicId, publicId)).get();
  if (!row || !isAnalysisGame(row.game)) return null;

  const [job, finding, match] = await Promise.all([
    db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, row.id)).get(),
    db.select().from(analysisFindings).where(eq(analysisFindings.analysisRequestId, row.id)).orderBy(asc(analysisFindings.priority)).get(),
    db.select().from(matches).where(eq(matches.analysisRequestId, row.id)).get(),
  ]);
  const resolution = decodePlayerResolutionContext(job?.errorMessage);
  let matchMetadata: Record<string, unknown> = {};
  try { matchMetadata = objectValue(match?.metadataJson ? JSON.parse(match.metadataJson) : {}); } catch { /* malformed private metadata must fail closed */ }
  const earlyAccessMetadata = objectValue(matchMetadata.earlyAccess);
  const verifiedMetadata = objectValue(earlyAccessMetadata.verifiedFacts);
  const performance = parsePerformance(matchMetadata.performanceSnapshot);
  const batchMetadata = objectValue(matchMetadata.batch);
  const batchRecurrence = Array.isArray(batchMetadata.recurrence) ? batchMetadata.recurrence.flatMap(item => {
    const entry = objectValue(item);
    const detectorId = nullableString(entry.detectorId);
    const matches = nullableNumber(entry.matches);
    const averageConfidence = nullableNumber(entry.averageConfidence);
    return detectorId && matches != null && averageConfidence != null ? [{ detectorId, matches, averageConfidence }] : [];
  }).slice(0, 8) : [];
  const batch = nullableString(batchMetadata.version) && nullableNumber(batchMetadata.validMatches) === 10 ? {
    version: String(batchMetadata.version),
    validMatches: 10,
    targetMatches: 10,
    excludedFiles: nullableNumber(batchMetadata.excludedFiles) ?? 0,
    playlist: nullableString(batchMetadata.playlist),
    confidence: nullableString(batchMetadata.confidence) || "insufficient",
    oneOffDetectorCount: nullableNumber(batchMetadata.oneOffDetectorCount) ?? 0,
    record: {
      wins: nullableNumber(objectValue(batchMetadata.record).wins) ?? 0,
      losses: nullableNumber(objectValue(batchMetadata.record).losses) ?? 0,
      draws: nullableNumber(objectValue(batchMetadata.record).draws) ?? 0,
      unknown: nullableNumber(objectValue(batchMetadata.record).unknown) ?? 0,
    },
    recurrence: batchRecurrence,
  } : null;
  const rawAssessments = Array.isArray(earlyAccessMetadata.assessments) ? earlyAccessMetadata.assessments : [];
  const rawCoverage = objectValue(earlyAccessMetadata.analysisCoverage);
  const coverageCategories = Array.isArray(rawCoverage.categories) ? rawCoverage.categories.flatMap(item => {
    const category = objectValue(item);
    const id = nullableString(category.id);
    const label = nullableString(category.label);
    if (!id || !label) return [];
    return [{
      id,
      label,
      total: nullableNumber(category.total) ?? 0,
      measuring: nullableNumber(category.measuring) ?? 0,
      capabilityAbstained: nullableNumber(category.capabilityAbstained) ?? 0,
      observed: nullableNumber(category.observed) ?? 0,
    }];
  }).slice(0, 9) : [];
  const analysisCoverage = nullableNumber(rawCoverage.totalDetectors) === 60 && coverageCategories.length === 9 ? {
    totalDetectors: 60,
    measuringDetectors: nullableNumber(rawCoverage.measuringDetectors) ?? 0,
    capabilityAbstained: nullableNumber(rawCoverage.capabilityAbstained) ?? 0,
    publicEligible: nullableNumber(rawCoverage.publicEligible) ?? 0,
    categories: coverageCategories,
  } : null;
  const persistedEarlyAccess = earlyAccessMetadata.formalValidationStatus === "not_validated" ? {
    badge: "EARLY ACCESS BETA" as const,
    heading: "Built from your real replay. Refined through expert validation." as const,
    body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard." as const,
    coachingStatus: earlyAccessMetadata.coachingStatus === "experimental_insight" ? "experimental_insight" as const : "abstained" as const,
    formalValidationStatus: "not_validated" as const,
    policyVersion: nullableString(earlyAccessMetadata.policyVersion),
    analysisCoverage,
    assessments: rawAssessments.flatMap(item => {
      const assessment = objectValue(item);
      const detectorId = nullableString(assessment.detectorId);
      const reason = nullableString(assessment.reason);
      const status = assessment.status === "experimental_insight" ? "experimental_insight" as const : assessment.status === "abstained" ? "abstained" as const : null;
      return detectorId && reason && status ? [{ detectorId, reason, status }] : [];
    }).slice(0, 12),
  } : null;
  const earlyAccess = persistedEarlyAccess && !options.earlyAccessOutputEnabled ? {
    ...persistedEarlyAccess,
    coachingStatus: "abstained" as const,
    assessments: [{
      detectorId: "early-access-output",
      status: "abstained" as const,
      reason: "Experimental coaching display is temporarily paused by the Early Access kill switch.",
    }],
  } : persistedEarlyAccess;

  return {
    publicId: row.publicId,
    game: row.game,
    gameLabel: gameLabels[row.game],
    currentRank: row.currentRank,
    targetRank: row.targetRank,
    status: row.status,
    createdAt: canonicalUtcTimestamp(row.createdAt) || row.createdAt,
    readyAt: canonicalUtcTimestamp(row.readyAt),
    processing: job ? {
      jobPublicId: job.publicId,
      status: job.status,
      stage: job.stage,
      stageLabel: job.stageLabel,
      attempts: job.attempts,
      errorCode: job.errorCode,
      durationMs: job.durationMs,
      estimatedCostMicros: job.estimatedCostMicros,
      nextRetryAt: canonicalUtcTimestamp(job.nextRetryAt),
      updatedAt: canonicalUtcTimestamp(job.updatedAt) || job.updatedAt,
      candidatePlayers: resolution.candidatePlayers,
      replayContext: resolution.replayContext,
      versions: {
        parser: job.parserVersion,
        analyzer: job.analyzerVersion,
        detector: job.detectorVersion,
        coaching: job.coachingVersion,
        schema: job.schemaVersion
      }
    } : null,
    report: row.status === "ready" && earlyAccess?.coachingStatus !== "abstained" && (row.evidenceType !== "replay_batch" || Boolean(finding)) ? {
      highestImpactMistake: row.highestImpactMistake,
      whyItCosts: row.whyItCosts,
      evidenceMoments: parseLines(row.evidenceMoments),
      evidenceDetails: parseEvidence(finding?.evidenceJson),
      nextQueueRule: row.nextQueueRule,
      practicePlan: parseLines(row.practicePlan),
      coachNote: row.coachNote,
      confidence: finding?.confidence ?? null,
      confidenceLabel: finding?.confidenceLabel ?? null,
      limitations: parseLimitations(finding?.limitationsJson),
      analysisSource: earlyAccess ? "experimental_early_access" : finding ? "automated" : "quality_review"
    } : null,
    verifiedFacts: match ? {
      subjectDisplayName: nullableString(verifiedMetadata.subjectDisplayName) || nullableString(objectValue(matchMetadata.subject).name),
      mode: nullableString(verifiedMetadata.mode) || match.mode,
      rank: nullableString(verifiedMetadata.rank) || match.rank,
      gameVersion: nullableString(verifiedMetadata.gameVersion) || match.gameVersion,
      occurredAt: canonicalUtcTimestamp(nullableString(verifiedMetadata.occurredAt) || match.occurredAt),
      playerCount: nullableNumber(verifiedMetadata.playerCount) ?? nullableNumber(matchMetadata.playerCount),
      sampledFrames: nullableNumber(verifiedMetadata.sampledFrames) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).frameState).frameCount),
      parserEvents: nullableNumber(verifiedMetadata.parserEvents) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).episodeTimeline).rawEventCount),
      decisionEvents: nullableNumber(verifiedMetadata.decisionEvents) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).episodeTimeline).decisionEventCount),
      parserVersion: match.parserVersion,
      rankProvenance: nullableString(verifiedMetadata.rankProvenance) === "verified_replay"
        ? "verified_replay" : match.rank ? "player_submitted" : "unknown",
    } : null,
    performance,
    batch,
    earlyAccess,
    feedbackScore: row.feedbackScore
  };
}
