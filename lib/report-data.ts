import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { analysisFindings, analysisJobs, analysisRequests, matches } from "../db/schema";
import { gameLabels, isAnalysisGame, parseLines, publicIdPattern } from "./analysis";
import { decodePlayerResolutionContext } from "./player-resolution.mjs";

type EvidenceDetail = {
  label: string;
  description: string;
  timestamp?: number | null;
  round?: number | null;
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
  };
  earlyAccess: null | {
    badge: "EARLY ACCESS BETA";
    heading: "Built from your real replay. Refined through expert validation.";
    body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard.";
    coachingStatus: "experimental_insight" | "abstained";
    formalValidationStatus: "not_validated";
    policyVersion: string | null;
    assessments: { detectorId: string; status: "experimental_insight" | "abstained"; reason: string }[];
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
  const rawAssessments = Array.isArray(earlyAccessMetadata.assessments) ? earlyAccessMetadata.assessments : [];
  const persistedEarlyAccess = earlyAccessMetadata.formalValidationStatus === "not_validated" ? {
    badge: "EARLY ACCESS BETA" as const,
    heading: "Built from your real replay. Refined through expert validation." as const,
    body: "This report is generated from verified match data and our latest coaching model. Coaching recommendations are experimental while expert validation continues. Your feedback helps shape the final Replay Method standard." as const,
    coachingStatus: earlyAccessMetadata.coachingStatus === "experimental_insight" ? "experimental_insight" as const : "abstained" as const,
    formalValidationStatus: "not_validated" as const,
    policyVersion: nullableString(earlyAccessMetadata.policyVersion),
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
    createdAt: row.createdAt,
    readyAt: row.readyAt,
    processing: job ? {
      jobPublicId: job.publicId,
      status: job.status,
      stage: job.stage,
      stageLabel: job.stageLabel,
      attempts: job.attempts,
      errorCode: job.errorCode,
      durationMs: job.durationMs,
      estimatedCostMicros: job.estimatedCostMicros,
      nextRetryAt: job.nextRetryAt,
      updatedAt: job.updatedAt,
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
    report: row.status === "ready" && earlyAccess?.coachingStatus !== "abstained" ? {
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
      occurredAt: nullableString(verifiedMetadata.occurredAt) || match.occurredAt,
      playerCount: nullableNumber(verifiedMetadata.playerCount) ?? nullableNumber(matchMetadata.playerCount),
      sampledFrames: nullableNumber(verifiedMetadata.sampledFrames) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).frameState).frameCount),
      parserEvents: nullableNumber(verifiedMetadata.parserEvents) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).episodeTimeline).rawEventCount),
      decisionEvents: nullableNumber(verifiedMetadata.decisionEvents) ?? nullableNumber(objectValue(objectValue(matchMetadata.evidenceEngine).episodeTimeline).decisionEventCount),
      parserVersion: match.parserVersion,
    } : null,
    earlyAccess,
    feedbackScore: row.feedbackScore
  };
}
