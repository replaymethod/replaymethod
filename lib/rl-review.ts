import reviewQueue from "../docs/RL_REVIEW_QUEUE.json";
import { getDb } from "../db";

export const RL_LABEL_SET_VERSION = "rocket-league-expert-labels.v1";
export const RL_REVIEW_VERDICTS = ["unreviewed", "confirmed", "rejected", "uncertain"] as const;
export type RlReviewVerdict = typeof RL_REVIEW_VERDICTS[number];

type QueueCandidate = {
  id: string;
  replayFingerprint: string;
  mode: string | null;
  gameVersion: string | null;
  detectorId: string;
  detectorVersion: string;
  reviewQuestion: string;
  timestampSeconds: number | null;
  frame: number | null;
  observation: Record<string, unknown>;
};

let seedPromise: Promise<void> | null = null;

export async function ensureRlReviewQueueSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await getDb();
      const { env } = await import("cloudflare:workers");
      const database = env.DB as D1Database;
      const current = await database.prepare("SELECT COUNT(*) AS count FROM rl_review_candidates").first<{ count: number }>();
      const candidates = reviewQueue.candidates as QueueCandidate[];
      if (Number(current?.count ?? 0) >= candidates.length) return;

      for (let offset = 0; offset < candidates.length; offset += 50) {
        const statements = candidates.slice(offset, offset + 50).map(candidate => database.prepare(`INSERT OR IGNORE INTO rl_review_candidates (
          candidate_key, replay_fingerprint, mode, game_version, detector_id, detector_version,
          review_question, timestamp_seconds, frame, observation_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          candidate.id,
          candidate.replayFingerprint,
          candidate.mode,
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
    "kickoff.speed": "Kickoff arrival",
    "possession.first_touch": "First-touch control",
    "challenge.dive": "Risky challenge"
  } as Record<string, string>)[detectorId] ?? detectorId;
}
