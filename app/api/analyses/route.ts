import { and, eq, sql } from "drizzle-orm";
import { getDatabase, getDb } from "../../../db";
import { analysisJobs, analysisRequests, gameAccounts, playerClaims, players, waitlist } from "../../../db/schema";
import { cleanText, emailPattern, isAnalysisGame, reportUrl } from "../../../lib/analysis";
import { attachAnalysisUsage, EntitlementError, releaseAnalysisUsage, reserveAnalysisAccess } from "../../../lib/analysis-entitlements";
import { coarseAnalyticsValue } from "../../../lib/analytics-policy.mjs";
import { sendAnalysisReceived } from "../../../lib/email";
import { createPlayerToken, expiresAt, hashPlayerToken, PLAYER_CLAIM_SECONDS } from "../../../lib/player-identity.mjs";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../lib/request-security.mjs";
import { replayUploadToken, sha256Hex } from "../../../lib/replay-upload.mjs";
import { REPORT_ACCESS_SECONDS } from "../../../lib/report-access.mjs";
import { subsystemEnabled } from "../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
const MAX_INTAKE_BYTES = 98 * 1024 * 1024;
const RL_PLATFORMS = new Set(["pc", "ps5", "xbox", "switch"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mpeg", ".mpg", ".m4v"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/mpeg", "video/x-m4v"]);
type StagedReplayRow = { id: number; objectKey: string; fileName: string; fileSize: number; status: string; analysisRequestId: number | null; updatedAt: string };

function validEvidenceUrl(raw: string) {
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString().slice(0, 1000) : "";
  } catch {
    return "";
  }
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "match.replay";
}

function isSupportedVideo(file: File) {
  const lower = file.name.toLowerCase();
  const extension = [...VIDEO_EXTENSIONS].find(item => lower.endsWith(item));
  return Boolean(extension && (!file.type || VIDEO_TYPES.has(file.type)));
}

function privateReportUrl(requestUrl: string, publicId: string, accessToken: string) {
  const url = new URL(reportUrl(requestUrl, publicId));
  url.searchParams.set("access", accessToken);
  return url.toString();
}

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  let deleteUploadedKeyOnFailure = false;
  let reservedPublicId: string | null = null;
  let stagedSessionId: number | null = null;
  let stagedAnalysisRequestId: number | null = null;
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "Invalid analysis request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
      return Response.json({ error: "Submit the analysis as form data." }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }
    if (declaredBodyTooLarge(request, MAX_INTAKE_BYTES)) {
      return Response.json({ error: "That upload is too large. Replay files may be 16 MB and gameplay videos may be 95 MB." }, { status: 413 });
    }
    const form = await request.formData();
    if (cleanText(form.get("company"), 200)) {
      return Response.json({ publicId: crypto.randomUUID().replaceAll("-", "") }, { status: 201 });
    }

    const email = cleanText(form.get("email"), 254).toLowerCase();
    const game = cleanText(form.get("game"), 30);
    const platform = cleanText(form.get("platform"), 20) || "pc";
    const currentRank = cleanText(form.get("currentRank"), 80);
    const targetRank = cleanText(form.get("targetRank"), 80) || null;
    const playerContext = cleanText(form.get("playerContext"), 160) || null;
    const goal = cleanText(form.get("goal"), 500);
    const notes = cleanText(form.get("notes"), 1600) || null;
    const evidenceUrl = validEvidenceUrl(cleanText(form.get("evidenceUrl"), 1000)) || null;
    const source = coarseAnalyticsValue(form.get("source"), 80, "direct");
    const campaign = coarseAnalyticsValue(form.get("campaign"), 120) || null;
    const dataConsent = form.get("dataConsent") === "true";
    const updatesConsent = form.get("updatesConsent") === "true";
    const replay = form.get("replay");
    const video = form.get("video");
    const uploadId = cleanText(form.get("uploadId"), 64);
    const uploadToken = cleanText(form.get("uploadToken"), 128) || replayUploadToken(request);
    const hasReplay = replay instanceof File && replay.size > 0;
    const hasVideo = video instanceof File && video.size > 0;
    const hasStagedReplay = Boolean(uploadId && uploadToken);
    const hasReplayEvidence = hasReplay || hasStagedReplay;
    const replayFirstRocketLeague = game === "rocket-league" && platform === "pc" && hasReplayEvidence;

    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!isAnalysisGame(game)) return Response.json({ error: "Choose a supported game." }, { status: 400 });
    if (game === "rocket-league" && !RL_PLATFORMS.has(platform)) return Response.json({ error: "Choose a supported Rocket League platform." }, { status: 400 });
    if (!replayFirstRocketLeague && currentRank.length < 2) return Response.json({ error: "Enter your current rank." }, { status: 400 });
    if (!replayFirstRocketLeague && playerContext == null) return Response.json({ error: "Add the player identity and mode or role." }, { status: 400 });
    if (!replayFirstRocketLeague && goal.length < 8) return Response.json({ error: "Tell us what you want to improve." }, { status: 400 });
    if (!dataConsent) return Response.json({ error: "Confirm that we may process the submitted match data." }, { status: 400 });

    const hasVideoEvidence = hasVideo || Boolean(evidenceUrl);

    if (hasReplay && hasStagedReplay) return Response.json({ error: "Submit either the saved replay upload or a direct file, not both." }, { status: 400 });
    if (game === "rocket-league" && platform === "pc" && hasReplayEvidence) {
      const { env } = await import("cloudflare:workers");
      const runtime = env as unknown as { RL_ENGINE_ENABLED?: string };
      if (!subsystemEnabled(runtime.RL_ENGINE_ENABLED)) {
        return Response.json({ error: "Rocket League replay processing is temporarily paused. Your file was not uploaded." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" } });
      }
    }

    if (game === "rocket-league" && platform !== "pc") {
      const { env } = await import("cloudflare:workers");
      if (!subsystemEnabled((env as unknown as { RL_VIDEO_ANALYSIS_ENABLED?: string }).RL_VIDEO_ANALYSIS_ENABLED)) {
        return Response.json({ error: "Console video analysis is not live yet. Join the console waitlist for first access." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "86400" } });
      }
    }

    if ((hasReplayEvidence || hasVideo) && game !== "rocket-league") return Response.json({ error: "File uploads are currently for Rocket League. Use a match or VOD link for this game." }, { status: 400 });
    if (hasReplay && (!replay.name.toLowerCase().endsWith(".replay") || replay.size > MAX_REPLAY_BYTES)) {
      return Response.json({ error: "Upload a Rocket League .replay file no larger than 16 MB." }, { status: 400 });
    }
    if (hasVideo && (!isSupportedVideo(video) || video.size > MAX_VIDEO_BYTES)) {
      return Response.json({ error: "Upload an MP4, MOV, WebM or MPEG gameplay video no larger than 95 MB." }, { status: 400 });
    }
    if (hasReplayEvidence && platform !== "pc") return Response.json({ error: "Console submissions use gameplay video or a VOD link, not a PC .replay file." }, { status: 400 });
    if (hasVideo && platform === "pc") return Response.json({ error: "Choose PS5, Xbox or Switch for video evidence, or upload the original PC .replay file." }, { status: 400 });
    if (game === "rocket-league" && platform === "pc" && !hasReplayEvidence) return Response.json({ error: "PC deep analysis requires the original .replay file." }, { status: 400 });
    if (game === "rocket-league" && platform !== "pc" && !hasVideoEvidence) return Response.json({ error: "Add a gameplay video or private/public VOD link for the console video beta." }, { status: 400 });
    if (!hasReplayEvidence && !hasVideo && !evidenceUrl) return Response.json({ error: "Add a match, replay, gameplay video or VOD link." }, { status: 400 });

    let bucket: R2Bucket | undefined;
    if (hasReplayEvidence || hasVideo) {
      const { env } = await import("cloudflare:workers");
      bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
      if (!bucket) return Response.json({ error: "Replay uploads are temporarily unavailable. Paste a Ballchasing or VOD link instead." }, { status: 503 });
    }

    const database = await getDatabase();
    const db = await getDb();
    const recent = await db.select({ count: sql<number>`count(*)` }).from(analysisRequests).where(and(
      eq(analysisRequests.email, email),
      sql`${analysisRequests.createdAt} >= datetime('now', '-24 hours')`
    )).get();
    if (Number(recent?.count || 0) >= 5) {
      return Response.json({ error: "You have reached the five-analysis daily beta limit. Try again tomorrow or contact us if a retry is needed." }, { status: 429 });
    }

    let stagedReplay: StagedReplayRow | null = null;
    if (hasStagedReplay) {
      if (!/^[a-f0-9]{32}$/.test(uploadId)) return Response.json({ error: "The saved replay upload is invalid. Start the upload again." }, { status: 400, headers: { "Cache-Control": "no-store" } });
      stagedReplay = await database.prepare(`SELECT id, object_key AS objectKey, file_name AS fileName, file_size AS fileSize,
        status, analysis_request_id AS analysisRequestId, updated_at AS updatedAt FROM replay_upload_sessions
        WHERE public_id = ? AND token_hash = ? AND email = ? AND expires_at > CURRENT_TIMESTAMP`)
        .bind(uploadId, await sha256Hex(uploadToken), email).first<StagedReplayRow>();
      if (!stagedReplay?.objectKey) return Response.json({ error: "The saved replay upload was not found or expired. Start the upload again." }, { status: 404, headers: { "Cache-Control": "no-store" } });
      if (stagedReplay.status === "claimed" && stagedReplay.analysisRequestId) {
        const existing = await database.prepare(`SELECT r.public_id AS publicId, j.public_id AS jobPublicId
          FROM analysis_requests r JOIN analysis_jobs j ON j.analysis_request_id = r.id WHERE r.id = ?`)
          .bind(stagedReplay.analysisRequestId).first<{ publicId: string; jobPublicId: string }>();
        if (existing) return Response.json({ ...existing, accessToken: uploadToken, url: privateReportUrl(request.url, existing.publicId, uploadToken), emailSent: false, idempotent: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      const stagedUpdatedAt = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(stagedReplay.updatedAt)
        ? new Date(stagedReplay.updatedAt).getTime()
        : new Date(`${stagedReplay.updatedAt.replace(" ", "T")}Z`).getTime();
      if (stagedReplay.status === "submitting" && Date.now() - stagedUpdatedAt >= 180_000) {
        const recovered = await database.prepare(`UPDATE replay_upload_sessions SET status = 'complete', analysis_request_id = NULL,
          updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'submitting' AND updated_at <= datetime('now', '-3 minutes')`)
          .bind(stagedReplay.id).run();
        if (recovered.meta.changes) stagedReplay.status = "complete";
      }
      if (stagedReplay.status !== "complete") {
        return Response.json({ error: "The saved replay is already being submitted. Retry in a moment; do not upload the file again." }, { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "2" } });
      }
      const claimed = await database.prepare(`UPDATE replay_upload_sessions SET status = 'submitting', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'complete'`).bind(stagedReplay.id).run();
      if (!claimed.meta.changes) return Response.json({ error: "The saved replay is already being submitted. Retry in a moment; do not upload the file again." }, { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "2" } });
      stagedSessionId = stagedReplay.id;
    }

    const publicId = crypto.randomUUID().replaceAll("-", "");
    await db.insert(players).values({
      publicId: crypto.randomUUID().replaceAll("-", ""),
      email
    }).onConflictDoUpdate({
      target: players.email,
      set: { updatedAt: new Date().toISOString() }
    });
    const player = await db.select({ id: players.id }).from(players).where(eq(players.email, email)).get();
    if (!player) throw new Error("Could not create the player identity.");
    await reserveAnalysisAccess(request, player.id, publicId);
    reservedPublicId = publicId;

    let originalFileName: string | null = null;
    let fileSize: number | null = null;
    let evidenceType = "link";

    if (stagedReplay) {
      originalFileName = safeFileName(stagedReplay.fileName);
      fileSize = stagedReplay.fileSize;
      evidenceType = "replay_file";
      uploadedKey = stagedReplay.objectKey;
    } else if (hasReplay || hasVideo) {
      const file = hasReplay ? replay : video;
      originalFileName = safeFileName(file.name);
      fileSize = file.size;
      evidenceType = hasReplay ? "replay_file" : "gameplay_video";
      const storageId = crypto.randomUUID().replaceAll("-", "");
      uploadedKey = `analyses/${storageId}/${originalFileName}`;
      deleteUploadedKeyOnFailure = true;
      await bucket.put(uploadedKey, file.stream(), {
        httpMetadata: { contentType: hasReplay ? "application/octet-stream" : (file.type || "video/mp4") },
        customMetadata: { game, platform, evidenceType, objectId: storageId }
      });
    } else if (game === "rocket-league" && platform !== "pc" && evidenceUrl) {
      evidenceType = "vod_link";
    }

    const inserted = await db.insert(analysisRequests).values({
      publicId,
      email,
      game,
      platform,
      currentRank: currentRank || "Pending replay context",
      targetRank,
      playerContext,
      evidenceType,
      evidenceUrl,
      fileKey: uploadedKey,
      originalFileName,
      fileSize,
      goal: goal || "Find the most useful evidence-backed focus in this replay.",
      notes,
      source,
      campaign
    }).returning({ id: analysisRequests.id }).get();
    if (stagedSessionId != null) stagedAnalysisRequestId = inserted.id;
    await attachAnalysisUsage(publicId, inserted.id);

    if (game === "rocket-league" && playerContext) {
      try {
        await db.insert(gameAccounts).values({
          publicId: crypto.randomUUID().replaceAll("-", ""),
          playerId: player.id,
          game,
          provider: "epic",
          displayName: playerContext
        }).onConflictDoUpdate({
          target: [gameAccounts.playerId, gameAccounts.game, gameAccounts.provider],
          set: { displayName: playerContext, updatedAt: new Date().toISOString() }
        });
      } catch (error) {
        console.warn("optional game account context was not saved", { code: operationalErrorCode(error) });
      }
    }

    const jobPublicId = crypto.randomUUID().replaceAll("-", "");
    await db.insert(analysisJobs).values({
      publicId: jobPublicId,
      analysisRequestId: inserted.id,
      playerId: player.id,
      game,
      status: "queued",
      stage: "queued",
      stageLabel: evidenceType === "replay_file" ? "Replay received" : evidenceType === "gameplay_video" || evidenceType === "vod_link" ? "Video evidence received" : "Match reference received",
      schemaVersion: "coaching.v1"
    });

    const accessToken = hasStagedReplay ? uploadToken : createPlayerToken();
    await database.prepare(`INSERT INTO analysis_report_access (token_hash, analysis_request_id, expires_at)
      VALUES (?, ?, ?)`).bind(await hashPlayerToken(accessToken), inserted.id, expiresAt(REPORT_ACCESS_SECONDS)).run();

    if (stagedSessionId != null) {
      const claimed = await database.prepare(`UPDATE replay_upload_sessions SET status = 'claimed', analysis_request_id = ?,
        claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'submitting'`)
        .bind(inserted.id, stagedSessionId).run();
      if (!claimed.meta.changes) throw new Error("Could not attach the saved replay upload to its analysis.");
      stagedSessionId = null;
      stagedAnalysisRequestId = null;
    }

    if (updatesConsent) {
      try {
        await db.insert(waitlist).values({ email, game, source, campaign, privacyVersion: "2026-08-16-beta" }).onConflictDoNothing();
      } catch (error) {
        // A newsletter opt-in must never block delivery of the requested analysis.
        console.warn("analysis waitlist opt-in failed", { code: operationalErrorCode(error) });
      }
    }

    const url = privateReportUrl(request.url, publicId, accessToken);
    let emailSent = false;
    try {
      const claimToken = createPlayerToken();
      await db.insert(playerClaims).values({
        tokenHash: await hashPlayerToken(claimToken),
        playerId: player.id,
        analysisRequestId: inserted.id,
        expiresAt: expiresAt(PLAYER_CLAIM_SECONDS)
      });
      emailSent = await sendAnalysisReceived({
        analysisRequestId: inserted.id,
        analysisPublicId: publicId,
        email,
        game,
        url: new URL(`/access/${claimToken}`, request.url).toString(),
      });
    } catch (error) {
      // The already-created analysis and browser status link remain usable.
      console.warn("analysis ownership delivery unavailable", { code: operationalErrorCode(error) });
    }

    return Response.json({ publicId, jobPublicId, accessToken, url, emailSent }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedKey && deleteUploadedKeyOnFailure) {
      try {
        const { env } = await import("cloudflare:workers");
        await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.delete(uploadedKey);
      } catch { /* best-effort cleanup */ }
    }
    const isAgentPreview = new URL(request.url).hostname === "terminal.local";
    const detail = error instanceof Error ? error.message : "Unknown server error";
    if (reservedPublicId) {
      try { await releaseAnalysisUsage(reservedPublicId); } catch (releaseError) { console.error("analysis usage release failed", { code: operationalErrorCode(releaseError) }); }
    }
    if (stagedSessionId != null) {
      try {
        const database = await getDatabase();
        if (stagedAnalysisRequestId != null) {
          await database.batch([
            database.prepare("DELETE FROM analysis_report_access WHERE analysis_request_id = ?").bind(stagedAnalysisRequestId),
            database.prepare("DELETE FROM analysis_jobs WHERE analysis_request_id = ?").bind(stagedAnalysisRequestId),
            database.prepare("DELETE FROM player_claims WHERE analysis_request_id = ?").bind(stagedAnalysisRequestId),
            database.prepare("DELETE FROM email_deliveries WHERE analysis_request_id = ?").bind(stagedAnalysisRequestId),
            database.prepare("DELETE FROM analysis_usage WHERE analysis_request_id = ?").bind(stagedAnalysisRequestId),
            database.prepare("DELETE FROM analysis_requests WHERE id = ?").bind(stagedAnalysisRequestId),
          ]);
        }
        await database.prepare(`UPDATE replay_upload_sessions SET status = 'complete', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'submitting'`).bind(stagedSessionId).run();
      } catch (releaseError) { console.error("staged replay release failed", { code: operationalErrorCode(releaseError) }); }
    }
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("analysis submission failed", { code: operationalErrorCode(error) });
    return Response.json({
      error: isAgentPreview
        ? `We couldn’t create the analysis. Preview detail: ${detail}`
        : "We couldn’t create the analysis. Try again."
    }, { status: 500 });
  }
}
