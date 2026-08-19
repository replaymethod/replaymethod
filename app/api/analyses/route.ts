import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { analysisJobs, analysisRequests, gameAccounts, playerClaims, players, waitlist } from "../../../db/schema";
import { cleanText, emailPattern, isAnalysisGame, reportUrl } from "../../../lib/analysis";
import { attachAnalysisUsage, EntitlementError, releaseAnalysisUsage, reserveAnalysisAccess } from "../../../lib/analysis-entitlements";
import { sendAnalysisReceived } from "../../../lib/email";
import { createPlayerToken, expiresAt, hashPlayerToken, PLAYER_CLAIM_SECONDS } from "../../../lib/player-identity.mjs";

export const runtime = "edge";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;

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
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > 17 * 1024 * 1024) {
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
    const source = cleanText(form.get("source"), 80).toLowerCase() || "direct";
    const campaign = cleanText(form.get("campaign"), 120) || null;
    const dataConsent = form.get("dataConsent") === "true";
    const updatesConsent = form.get("updatesConsent") === "true";
    const replay = form.get("replay");

    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!isAnalysisGame(game)) return Response.json({ error: "Choose a supported game." }, { status: 400 });
    if (currentRank.length < 2) return Response.json({ error: "Enter your current rank." }, { status: 400 });
    if (playerContext == null) return Response.json({ error: "Add the player identity and mode or role." }, { status: 400 });
    if (goal.length < 8) return Response.json({ error: "Tell us what you want to improve." }, { status: 400 });
    if (!dataConsent) return Response.json({ error: "Confirm that we may process the submitted match data." }, { status: 400 });

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
      uploadedKey = `analyses/${publicId}/${originalFileName}`;
      await bucket.put(uploadedKey, replay.stream(), {
        httpMetadata: { contentType: replay.type || "application/octet-stream" },
        customMetadata: { game, publicId }
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

    const provider = game === "rocket-league" ? "epic" : "riot";
    if (playerContext) {
      await db.insert(gameAccounts).values({
        publicId: crypto.randomUUID().replaceAll("-", ""),
        playerId: player.id,
        game,
        provider,
        displayName: playerContext
      }).onConflictDoUpdate({
        target: [gameAccounts.playerId, gameAccounts.game, gameAccounts.provider],
        set: { displayName: playerContext, updatedAt: new Date().toISOString() }
      });
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
        console.warn("analysis waitlist opt-in failed", error);
      }
    }

    const url = reportUrl(request.url, publicId);
    const claimToken = createPlayerToken();
    await db.insert(playerClaims).values({
      tokenHash: await hashPlayerToken(claimToken),
      playerId: player.id,
      analysisRequestId: inserted.id,
      expiresAt: expiresAt(PLAYER_CLAIM_SECONDS)
    });
    const ownershipUrl = new URL(`/access/${claimToken}`, request.url).toString();
    let emailSent = false;
    try {
      emailSent = await sendAnalysisReceived({
        analysisRequestId: inserted.id,
        analysisPublicId: publicId,
        email,
        game,
        url: ownershipUrl,
      });
    } catch { /* status link remains the delivery fallback */ }

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
      try { await releaseAnalysisUsage(reservedPublicId); } catch (releaseError) { console.error("analysis usage release failed", releaseError); }
    }
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("analysis submission failed", error);
    return Response.json({
      error: isAgentPreview
        ? `We couldn’t create the analysis. Preview detail: ${detail}`
        : "We couldn’t create the analysis. Try again."
    }, { status: 500 });
  }
}
