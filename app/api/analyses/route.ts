import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { analysisJobs, analysisRequests, gameAccounts, playerClaims, players, waitlist } from "../../../db/schema";
import { cleanText, emailPattern, isAnalysisGame, reportUrl } from "../../../lib/analysis";
import { attachAnalysisUsage, EntitlementError, releaseAnalysisUsage, reserveAnalysisAccess } from "../../../lib/analysis-entitlements";
import { coarseAnalyticsValue } from "../../../lib/analytics-policy.mjs";
import { sendAnalysisReceived } from "../../../lib/email";
import { createPlayerToken, expiresAt, hashPlayerToken, PLAYER_CLAIM_SECONDS } from "../../../lib/player-identity.mjs";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../lib/request-security.mjs";
import { subsystemEnabled } from "../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const MAX_INTAKE_BYTES = 17 * 1024 * 1024;

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

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  let reservedPublicId: string | null = null;
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json({ error: "Invalid analysis request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
      return Response.json({ error: "Submit the analysis as form data." }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }
    if (declaredBodyTooLarge(request, MAX_INTAKE_BYTES)) {
      return Response.json({ error: "That upload is too large. Rocket League replay files may be at most 16 MB." }, { status: 413 });
    }
    const form = await request.formData();
    if (cleanText(form.get("company"), 200)) {
      return Response.json({ publicId: crypto.randomUUID().replaceAll("-", "") }, { status: 201 });
    }

    const email = cleanText(form.get("email"), 254).toLowerCase();
    const game = cleanText(form.get("game"), 30);
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

    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!isAnalysisGame(game)) return Response.json({ error: "Choose a supported game." }, { status: 400 });
    if (currentRank.length < 2) return Response.json({ error: "Enter your current rank." }, { status: 400 });
    if (playerContext == null) return Response.json({ error: "Add the player identity and mode or role." }, { status: 400 });
    if (goal.length < 8) return Response.json({ error: "Tell us what you want to improve." }, { status: 400 });
    if (!dataConsent) return Response.json({ error: "Confirm that we may process the submitted match data." }, { status: 400 });

    if (game === "rocket-league") {
      const { env } = await import("cloudflare:workers");
      if (!subsystemEnabled((env as unknown as { RL_ENGINE_ENABLED?: string }).RL_ENGINE_ENABLED)) {
        return Response.json({ error: "Rocket League replay intake is temporarily closed while the production quality gate is completed. Join the beta list for first access." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "86400" } });
      }
    }

    const hasFile = replay instanceof File && replay.size > 0;
    if (hasFile && game !== "rocket-league") return Response.json({ error: "Replay file uploads are currently for Rocket League. Use a match or VOD link for this game." }, { status: 400 });
    if (hasFile && (!replay.name.toLowerCase().endsWith(".replay") || replay.size > MAX_REPLAY_BYTES)) {
      return Response.json({ error: "Upload a Rocket League .replay file no larger than 16 MB." }, { status: 400 });
    }
    if (game === "rocket-league" && !hasFile) return Response.json({ error: "Automatic Rocket League coaching requires the original .replay file." }, { status: 400 });
    if (!hasFile && !evidenceUrl) return Response.json({ error: "Add a match, replay or VOD link." }, { status: 400 });

    let bucket: R2Bucket | undefined;
    if (hasFile) {
      const { env } = await import("cloudflare:workers");
      bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
      if (!bucket) return Response.json({ error: "Replay uploads are temporarily unavailable. Paste a Ballchasing or VOD link instead." }, { status: 503 });
    }

    const db = await getDb();
    const recent = await db.select({ count: sql<number>`count(*)` }).from(analysisRequests).where(and(
      eq(analysisRequests.email, email),
      sql`${analysisRequests.createdAt} >= datetime('now', '-24 hours')`
    )).get();
    if (Number(recent?.count || 0) >= 5) {
      return Response.json({ error: "You have reached the five-analysis daily beta limit. Try again tomorrow or contact us if a retry is needed." }, { status: 429 });
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

    if (hasFile) {
      originalFileName = safeFileName(replay.name);
      fileSize = replay.size;
      evidenceType = "replay_file";
      const storageId = crypto.randomUUID().replaceAll("-", "");
      uploadedKey = `analyses/${storageId}/${originalFileName}`;
      await bucket.put(uploadedKey, replay.stream(), {
        httpMetadata: { contentType: "application/octet-stream" },
        customMetadata: { game, objectId: storageId }
      });
    }

    const inserted = await db.insert(analysisRequests).values({
      publicId,
      email,
      game,
      currentRank,
      targetRank,
      playerContext,
      evidenceType,
      evidenceUrl,
      fileKey: uploadedKey,
      originalFileName,
      fileSize,
      goal,
      notes,
      source,
      campaign
    }).returning({ id: analysisRequests.id }).get();
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
      stageLabel: "Upload received",
      schemaVersion: "coaching.v1"
    });

    if (updatesConsent) {
      try {
        await db.insert(waitlist).values({ email, game, source, campaign, privacyVersion: "2026-08-16-beta" }).onConflictDoNothing();
      } catch (error) {
        // A newsletter opt-in must never block delivery of the requested analysis.
        console.warn("analysis waitlist opt-in failed", { code: operationalErrorCode(error) });
      }
    }

    const url = reportUrl(request.url, publicId);
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

    return Response.json({ publicId, jobPublicId, url, emailSent }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedKey) {
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
