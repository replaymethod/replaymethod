import { getDb } from "../../../../db";
import { requireSiteAdminMutation } from "../../../../lib/admin";
import { declaredBodyTooLarge, operationalErrorCode } from "../../../../lib/request-security.mjs";

const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
const MAX_CANDIDATES = 300;
const CHUNK_SIZE = 25;
const supportedModes = new Set(["1v1", "2v2", "3v3"]);

type Candidate = {
  id: string;
  replayFingerprint: string;
  mode: string;
  rankCohort: string;
  cohortKey: string;
  metadataProvenance: string;
  gameVersion: string | null;
  detectorId: string;
  detectorVersion: string;
  reviewQuestion: string;
  timestampSeconds: number | null;
  frame: number | null;
  observation: Record<string, unknown>;
};

function bounded(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return bounded(row.id, 300).length > 10
    && /^[a-f0-9]{16}$/.test(bounded(row.replayFingerprint, 16))
    && supportedModes.has(bounded(row.mode, 8))
    && bounded(row.rankCohort, 80).length > 0
    && bounded(row.detectorId, 120).length > 0
    && bounded(row.detectorVersion, 80).length > 0
    && bounded(row.reviewQuestion, 500).length > 0
    && Boolean(row.observation && typeof row.observation === "object");
}

async function objectId(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function POST(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  if (declaredBodyTooLarge(request, MAX_IMPORT_BYTES)) return Response.json({ error: "Review import is larger than 12 MB." }, { status: 413 });

  try {
    const form = await request.formData();
    const queueFile = form.get("queue");
    const momentsFile = form.get("moments");
    if (!(queueFile instanceof File) || !(momentsFile instanceof File)) {
      return Response.json({ error: "Choose both the private review queue and moments artifacts." }, { status: 400 });
    }
    if (queueFile.size + momentsFile.size > MAX_IMPORT_BYTES) return Response.json({ error: "Review import is larger than 12 MB." }, { status: 413 });

    const queue = JSON.parse(await queueFile.text()) as Record<string, unknown>;
    const artifact = JSON.parse(await momentsFile.text()) as Record<string, unknown>;
    const candidates = Array.isArray(queue.candidates) ? queue.candidates.filter(validCandidate) : [];
    const moments = artifact.moments && typeof artifact.moments === "object" ? artifact.moments as Record<string, unknown> : {};
    if (!candidates.length || candidates.length > MAX_CANDIDATES || candidates.length !== (queue.candidates as unknown[])?.length) {
      return Response.json({ error: `Review queue must contain 1–${MAX_CANDIDATES} valid candidates.` }, { status: 400 });
    }
    if (queue.holdoutIncluded !== false || queue.sourceCorpusAssignment !== "calibration") {
      return Response.json({ error: "Only the locked calibration split may enter the tuning review queue." }, { status: 400 });
    }
    if (candidates.some(candidate => !moments[candidate.id])) {
      return Response.json({ error: "Every candidate needs an anonymized replay moment." }, { status: 400 });
    }

    await getDb();
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { DB: D1Database; BUCKET: R2Bucket };
    if (!runtime.BUCKET) return Response.json({ error: "Private review storage is unavailable." }, { status: 503 });
    const importId = await objectId(`${queueFile.name}:${queueFile.size}:${momentsFile.size}:${bounded(queue.reproducibilityFingerprint, 80)}`);
    const momentKeys = new Map<string, string>();

    for (let offset = 0; offset < candidates.length; offset += CHUNK_SIZE) {
      const chunkCandidates = candidates.slice(offset, offset + CHUNK_SIZE);
      const objectKey = `rl-review-private/${importId}/moments-${String(offset / CHUNK_SIZE + 1).padStart(2, "0")}.json`;
      const chunk = Object.fromEntries(chunkCandidates.map(candidate => [candidate.id, moments[candidate.id]]));
      await runtime.BUCKET.put(objectKey, JSON.stringify({ schemaVersion: "rocket-league-review-moment-chunk.v1", moments: chunk }), {
        httpMetadata: { contentType: "application/json" },
        customMetadata: { purpose: "blind-review", source: "private-calibration-corpus", importId },
      });
      for (const candidate of chunkCandidates) momentKeys.set(candidate.id, objectKey);
    }

    for (let offset = 0; offset < candidates.length; offset += CHUNK_SIZE) {
      await runtime.DB.batch(candidates.slice(offset, offset + CHUNK_SIZE).map(candidate => runtime.DB.prepare(`INSERT INTO rl_review_candidates (
          candidate_key, replay_fingerprint, mode, rank_cohort, context_key, metadata_provenance, game_version,
          detector_id, detector_version, review_question, timestamp_seconds, frame, observation_json, moment_object_key, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(candidate_key) DO UPDATE SET mode = excluded.mode, rank_cohort = excluded.rank_cohort,
          context_key = excluded.context_key, metadata_provenance = excluded.metadata_provenance,
          game_version = excluded.game_version, detector_id = excluded.detector_id,
          detector_version = excluded.detector_version, review_question = excluded.review_question,
          timestamp_seconds = excluded.timestamp_seconds, frame = excluded.frame,
          observation_json = excluded.observation_json, moment_object_key = excluded.moment_object_key,
          updated_at = CURRENT_TIMESTAMP`).bind(
          bounded(candidate.id, 300), candidate.replayFingerprint, candidate.mode,
          bounded(candidate.rankCohort, 80), bounded(candidate.cohortKey, 180),
          bounded(candidate.metadataProvenance, 120) || "private-corpus-manifest",
          bounded(candidate.gameVersion, 120) || null, bounded(candidate.detectorId, 120),
          bounded(candidate.detectorVersion, 80), bounded(candidate.reviewQuestion, 500),
          Number.isFinite(candidate.timestampSeconds) ? candidate.timestampSeconds : null,
          Number.isInteger(candidate.frame) ? candidate.frame : null,
          JSON.stringify(candidate.observation).slice(0, 20_000), momentKeys.get(candidate.id),
        )));
    }

    return Response.json({ imported: candidates.length, chunks: Math.ceil(candidates.length / CHUNK_SIZE), holdoutIncluded: false });
  } catch (error) {
    console.error("private review queue import failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "The private review queue could not be imported." }, { status: 500 });
  }
}
