import { getDb } from "../../../../db";
import { requireSiteAdminMutation } from "../../../../lib/admin";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { RL_PRIVATE_REVIEW_SET } from "../../../../lib/rl-review";
import { RL_LABEL_SET_VERSION } from "../../../../lib/rl-review";
import { declaredBodyTooLarge, operationalErrorCode } from "../../../../lib/request-security.mjs";

const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
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

async function sha256(value: File) {
  const digest = await crypto.subtle.digest("SHA-256", await value.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function artifactText(value: File) {
  const gzip = value.name.endsWith(".gz") || value.type === "application/gzip" || value.type === "application/x-gzip";
  if (!gzip) return value.text();
  return new Response(value.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

export async function POST(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  const actor = await getChatGPTUser();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (declaredBodyTooLarge(request, MAX_IMPORT_BYTES)) return Response.json({ error: "Review import is larger than 12 MB." }, { status: 413 });

  try {
    const form = await request.formData();
    const queueFile = form.get("queue");
    const momentsFile = form.get("moments");
    if (!(queueFile instanceof File) || !(momentsFile instanceof File)) {
      return Response.json({ error: "Choose both the private review queue and moments artifacts." }, { status: 400 });
    }
    if (queueFile.size + momentsFile.size > MAX_IMPORT_BYTES) return Response.json({ error: "Review import is larger than 12 MB." }, { status: 413 });

    const [queueSha256, momentsSha256] = await Promise.all([sha256(queueFile), sha256(momentsFile)]);
    if (queueSha256 !== RL_PRIVATE_REVIEW_SET.queueSha256 || momentsSha256 !== RL_PRIVATE_REVIEW_SET.momentsSha256) {
      return Response.json({
        error: "These files are not the owner-authorized locked calibration artifacts.",
        queueSha256,
        momentsSha256,
      }, { status: 400 });
    }
    const [queueText, momentsText] = await Promise.all([artifactText(queueFile), artifactText(momentsFile)]);
    const [queueContentSha256, momentsContentSha256] = await Promise.all([sha256Text(queueText), sha256Text(momentsText)]);
    if (queueContentSha256 !== RL_PRIVATE_REVIEW_SET.queueContentSha256 || momentsContentSha256 !== RL_PRIVATE_REVIEW_SET.momentsContentSha256) {
      return Response.json({ error: "The decompressed review artifacts do not match the locked canonical content." }, { status: 400 });
    }
    const queue = JSON.parse(queueText) as Record<string, unknown>;
    const artifact = JSON.parse(momentsText) as Record<string, unknown>;
    const candidates = Array.isArray(queue.candidates) ? queue.candidates.filter(validCandidate) : [];
    const moments = artifact.moments && typeof artifact.moments === "object" ? artifact.moments as Record<string, unknown> : {};
    if (candidates.length !== RL_PRIVATE_REVIEW_SET.candidateCount || candidates.length !== (queue.candidates as unknown[])?.length) {
      return Response.json({ error: `Locked review queue must contain exactly ${RL_PRIVATE_REVIEW_SET.candidateCount} valid candidates.` }, { status: 400 });
    }
    if (queue.holdoutIncluded !== false
      || queue.sourceCorpusAssignment !== RL_PRIVATE_REVIEW_SET.sourceCorpusAssignment
      || queue.schemaVersion !== RL_PRIVATE_REVIEW_SET.queueSchemaVersion
      || queue.sourceReportFingerprint !== RL_PRIVATE_REVIEW_SET.sourceReportFingerprint
      || queue.labelSetVersion !== RL_LABEL_SET_VERSION) {
      return Response.json({ error: "Only the exact locked calibration_dev opportunity set may enter the tuning review queue." }, { status: 400 });
    }
    const candidateKeys = new Set(candidates.map(candidate => candidate.id));
    const replayKeys = new Set(candidates.map(candidate => candidate.replayFingerprint));
    const momentKeysInArtifact = Object.keys(moments);
    if (candidateKeys.size !== RL_PRIVATE_REVIEW_SET.candidateCount || replayKeys.size !== RL_PRIVATE_REVIEW_SET.replayCount) {
      return Response.json({ error: "Locked review queue identity or replay-count verification failed." }, { status: 400 });
    }
    if (momentKeysInArtifact.length !== RL_PRIVATE_REVIEW_SET.candidateCount || momentKeysInArtifact.some(key => !candidateKeys.has(key))) {
      return Response.json({ error: "The moments artifact must match the locked candidate set exactly." }, { status: 400 });
    }
    if (candidates.some(candidate => {
      const moment = moments[candidate.id] as Record<string, unknown> | undefined;
      return !moment || moment.candidateKey !== candidate.id || moment.replayFingerprint !== candidate.replayFingerprint;
    })) {
      return Response.json({ error: "Candidate-to-moment provenance verification failed." }, { status: 400 });
    }

    await getDb();
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { DB: D1Database; BUCKET: R2Bucket };
    if (!runtime.BUCKET) return Response.json({ error: "Private review storage is unavailable." }, { status: 503 });
    const importId = await objectId(`${RL_PRIVATE_REVIEW_SET.id}:${queueSha256}:${momentsSha256}`);
    const objectPrefix = `rl-review-private/${importId}`;
    const momentKeys = new Map<string, string>();

    for (let offset = 0; offset < candidates.length; offset += CHUNK_SIZE) {
      const chunkCandidates = candidates.slice(offset, offset + CHUNK_SIZE);
      const objectKey = `${objectPrefix}/moments-${String(offset / CHUNK_SIZE + 1).padStart(2, "0")}.json`;
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
          detector_id, detector_version, review_question, timestamp_seconds, frame, observation_json, moment_object_key,
          review_set_id, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(candidate_key) DO UPDATE SET mode = excluded.mode, rank_cohort = excluded.rank_cohort,
          context_key = excluded.context_key, metadata_provenance = excluded.metadata_provenance,
          game_version = excluded.game_version, detector_id = excluded.detector_id,
          detector_version = excluded.detector_version, review_question = excluded.review_question,
          timestamp_seconds = excluded.timestamp_seconds, frame = excluded.frame,
          observation_json = excluded.observation_json, moment_object_key = excluded.moment_object_key,
          review_set_id = excluded.review_set_id, active = 1,
          updated_at = CURRENT_TIMESTAMP`).bind(
          bounded(candidate.id, 300), candidate.replayFingerprint, candidate.mode,
          bounded(candidate.rankCohort, 80), bounded(candidate.cohortKey, 180),
          bounded(candidate.metadataProvenance, 120) || "private-corpus-manifest",
          bounded(candidate.gameVersion, 120) || null, bounded(candidate.detectorId, 120),
          bounded(candidate.detectorVersion, 80), bounded(candidate.reviewQuestion, 500),
          Number.isFinite(candidate.timestampSeconds) ? candidate.timestampSeconds : null,
          Number.isInteger(candidate.frame) ? candidate.frame : null,
          JSON.stringify(candidate.observation).slice(0, 20_000), momentKeys.get(candidate.id), RL_PRIVATE_REVIEW_SET.id,
        )));
    }

    await runtime.DB.batch([
      runtime.DB.prepare("UPDATE rl_review_candidates SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE review_set_id IS NULL OR review_set_id != ?").bind(RL_PRIVATE_REVIEW_SET.id),
      runtime.DB.prepare(`INSERT INTO rl_review_imports (
        import_id, review_set_id, queue_sha256, moments_sha256, corpus_manifest_sha256, holdout_report_sha256,
        holdout_reproducibility_fingerprint, candidate_count, replay_count, holdout_overlap_count, object_prefix, imported_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(import_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP, imported_by = excluded.imported_by`).bind(
        importId, RL_PRIVATE_REVIEW_SET.id, queueSha256, momentsSha256,
        RL_PRIVATE_REVIEW_SET.corpusManifestSha256, RL_PRIVATE_REVIEW_SET.holdoutReportSha256,
        RL_PRIVATE_REVIEW_SET.holdoutReproducibilityFingerprint, candidates.length, replayKeys.size,
        objectPrefix, actor.email.toLowerCase()
      )
    ]);

    return Response.json({
      imported: candidates.length,
      replayCount: replayKeys.size,
      chunks: Math.ceil(candidates.length / CHUNK_SIZE),
      reviewSetId: RL_PRIVATE_REVIEW_SET.id,
      importId,
      queueSha256,
      momentsSha256,
      holdoutOverlapCount: 0,
      idempotent: true,
    });
  } catch (error) {
    console.error("private review queue import failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "The private review queue could not be imported." }, { status: 500 });
  }
}
