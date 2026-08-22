import reviewQueue from "../docs/RL_REVIEW_QUEUE.json";
import { getDb } from "../db";

export const RL_LABEL_SET_VERSION = "rocket-league-expert-labels.v2";
export const RL_REVIEW_VERDICTS = ["unreviewed", "confirmed", "rejected", "uncertain"] as const;
export type RlReviewVerdict = typeof RL_REVIEW_VERDICTS[number];

type QueueCandidate = {
  id: string;
  replayFingerprint: string;
  mode: string | null;
  rankCohort?: string | null;
  cohortKey?: string | null;
  metadataProvenance?: string | null;
  gameVersion: string | null;
  detectorId: string;
  detectorVersion: string;
  reviewQuestion: string;
  timestampSeconds: number | null;
  frame: number | null;
  observation: Record<string, unknown>;
};

let seedPromise: Promise<void> | null = null;
const currentCandidates = reviewQueue.candidates as QueueCandidate[];
export const RL_REVIEW_CANDIDATE_KEYS = new Set(currentCandidates.map(candidate => candidate.id));

export async function ensureRlReviewQueueSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await getDb();
      const { env } = await import("cloudflare:workers");
      const database = env.DB as D1Database;
      const existingRows = await database.prepare("SELECT candidate_key AS candidateKey FROM rl_review_candidates").all<{ candidateKey: string }>();
      const existingKeys = new Set((existingRows.results ?? []).map(row => row.candidateKey));
      const candidates = currentCandidates.filter(candidate => !existingKeys.has(candidate.id));
      if (!candidates.length) return;

      for (let offset = 0; offset < candidates.length; offset += 50) {
        const statements = candidates.slice(offset, offset + 50).map(candidate => database.prepare(`INSERT OR IGNORE INTO rl_review_candidates (
          candidate_key, replay_fingerprint, mode, rank_cohort, context_key, metadata_provenance, game_version, detector_id, detector_version,
          review_question, timestamp_seconds, frame, observation_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          candidate.id,
          candidate.replayFingerprint,
          candidate.mode,
          candidate.rankCohort ?? null,
          candidate.cohortKey ?? null,
          candidate.metadataProvenance ?? "checked_in_real_replay",
          candidate.gameVersion,
          candidate.detectorId,
          candidate.detectorVersion,
          candidate.reviewQuestion,
          candidate.timestampSeconds,
          candidate.frame,
          JSON.stringify(candidate.observation)
        ));
        await database.batch(statements);
      }
    })().catch(error => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
}
export function isRlReviewVerdict(value: unknown): value is RlReviewVerdict {
  return typeof value === "string" && (RL_REVIEW_VERDICTS as readonly string[]).includes(value);
}

export function detectorName(detectorId: string) {
  return ({
    "boost.zero_duration": "Zero-boost exposure",
    "boost.supersonic_waste": "Supersonic boost waste",
    "kickoff.speed": "Kickoff arrival",
    "possession.first_touch": "First-touch control",
    "challenge.dive": "Risky challenge",
    "rotation.spacing_too_close": "Compressed spacing",
    "teamplay.double_commit": "Double commit",
    "recovery.momentum_loss": "Momentum loss"
  } as Record<string, string>)[detectorId] ?? detectorId;
}

export function reviewerPlaylistScopes(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
    return new Set(["1v1", "2v2", "3v3"].filter(mode => typeof parsed[mode] === "string" && parsed[mode] !== "unverified"));
  } catch {
    return new Set<string>();
  }
}
