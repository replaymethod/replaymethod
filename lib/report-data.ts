import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { analysisFindings, analysisJobs, analysisRequests } from "../db/schema";
import { gameLabels, isAnalysisGame, parseLines, publicIdPattern } from "./analysis";

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
    analysisSource: "automated" | "quality_review";
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
  }).slice(0, 8);
}

function parseLimitations(value: string | null | undefined): string[] {
  return parseArray(value).filter((item): item is string => typeof item === "string").slice(0, 8);
}

export async function loadPublicReport(publicId: string): Promise<PublicReportData | null> {
  if (!publicIdPattern.test(publicId)) return null;
  const db = await getDb();
  const row = await db.select().from(analysisRequests).where(eq(analysisRequests.publicId, publicId)).get();
  if (!row || !isAnalysisGame(row.game)) return null;

  const [job, finding] = await Promise.all([
    db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, row.id)).get(),
    db.select().from(analysisFindings).where(eq(analysisFindings.analysisRequestId, row.id)).orderBy(asc(analysisFindings.priority)).get()
  ]);

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
      versions: {
        parser: job.parserVersion,
        analyzer: job.analyzerVersion,
        detector: job.detectorVersion,
        coaching: job.coachingVersion,
        schema: job.schemaVersion
      }
    } : null,
    report: row.status === "ready" ? {
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
      analysisSource: finding ? "automated" : "quality_review"
    } : null,
    feedbackScore: row.feedbackScore
  };
}
