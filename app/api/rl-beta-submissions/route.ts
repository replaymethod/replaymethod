import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { rlBetaSubmissions, waitlist } from "../../../db/schema";
import { cleanText, emailPattern } from "../../../lib/analysis";
import { coarseAnalyticsValue } from "../../../lib/analytics-policy.mjs";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../lib/request-security.mjs";
import { subsystemEnabled } from "../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
const MAX_INTAKE_BYTES = MAX_REPLAY_BYTES + 256 * 1024;
const CONSENT_VERSION = "2026-08-21-rl-calibration";
const RANK_COHORTS = new Set(["bronze-silver", "gold-platinum", "diamond-champion", "grand-champion-ssl"]);

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "match.replay";
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid beta submission." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "multipart/form-data") {
      return Response.json({ error: "Submit the replay as form data." }, { status: 415, headers: { "Cache-Control": "no-store" } });
    }
    if (declaredBodyTooLarge(request, MAX_INTAKE_BYTES)) {
      return Response.json({ error: "That replay is larger than 16 MB." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }

    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { RL_CALIBRATION_INTAKE_ENABLED?: string; BUCKET?: R2Bucket };
    if (!subsystemEnabled(runtime.RL_CALIBRATION_INTAKE_ENABLED)) {
      return Response.json({ error: "Private replay collection is not open yet. Join the beta list for first access." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "86400" } });
    }

    const form = await request.formData();
    if (cleanText(form.get("company"), 200)) return Response.json({ received: true }, { status: 201 });

    const email = cleanText(form.get("email"), 254).toLowerCase();
    const playerName = cleanText(form.get("playerName"), 80);
    const rankCohort = cleanText(form.get("rankCohort"), 40);
    const source = coarseAnalyticsValue(form.get("source"), 80, "direct");
    const campaign = coarseAnalyticsValue(form.get("campaign"), 120) || null;
    const calibrationConsent = form.get("calibrationConsent") === "true";
    const rightsConfirmed = form.get("rightsConfirmed") === "true";
    const updatesConsent = form.get("updatesConsent") === "true";
    const replay = form.get("replay");

    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!playerName) return Response.json({ error: "Enter your exact in-game player name." }, { status: 400 });
    if (!RANK_COHORTS.has(rankCohort)) return Response.json({ error: "Choose your current rank group." }, { status: 400 });
    if (!calibrationConsent) return Response.json({ error: "Confirm that Replay Method may privately store and review this replay for calibration." }, { status: 400 });
    if (!rightsConfirmed) return Response.json({ error: "Confirm that you are permitted to share this replay." }, { status: 400 });
    if (!(replay instanceof File) || replay.size === 0) return Response.json({ error: "Choose an original Rocket League .replay file." }, { status: 400 });
    if (!replay.name.toLowerCase().endsWith(".replay") || replay.size > MAX_REPLAY_BYTES) {
      return Response.json({ error: "Choose an original .replay file no larger than 16 MB." }, { status: 400 });
    }
    if (!runtime.BUCKET) return Response.json({ error: "Private replay storage is unavailable. Try again later." }, { status: 503 });

    const bytes = await replay.arrayBuffer();
    const replayFingerprint = hex(await crypto.subtle.digest("SHA-256", bytes));
    const db = await getDb();
    const recent = await db.select({ count: sql<number>`count(*)` }).from(rlBetaSubmissions).where(and(
      eq(rlBetaSubmissions.email, email),
      sql`${rlBetaSubmissions.createdAt} >= datetime('now', '-24 hours')`
    )).get();
    if (Number(recent?.count || 0) >= 5) return Response.json({ error: "You have reached today’s five-replay beta limit." }, { status: 429 });

    const duplicate = await db.select({ publicId: rlBetaSubmissions.publicId }).from(rlBetaSubmissions).where(and(
      eq(rlBetaSubmissions.email, email),
      eq(rlBetaSubmissions.replayFingerprint, replayFingerprint)
    )).get();
    if (duplicate) return Response.json({
      received: true,
      duplicate: true,
      publicId: duplicate.publicId,
      state: { file: "secured", parser: "pending", playerAttribution: "pending", modeVerification: "pending", coaching: "gated" }
    }, { status: 200, headers: { "Cache-Control": "no-store" } });

    const publicId = crypto.randomUUID().replaceAll("-", "");
    const originalFileName = safeFileName(replay.name);
    uploadedKey = `rl-calibration/${publicId}/${originalFileName}`;
    await runtime.BUCKET.put(uploadedKey, bytes, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { objectId: publicId, purpose: "rl-calibration", mode: "2v2" }
    });

    await db.insert(rlBetaSubmissions).values({
      publicId,
      email,
      playerName,
      rankCohort,
      replayFingerprint,
      fileKey: uploadedKey,
      originalFileName,
      fileSize: replay.size,
      status: "received",
      parserStatus: "pending",
      attributionStatus: "pending",
      usabilityStatus: "pending",
      reviewState: "not_started",
      source,
      campaign,
      consentVersion: CONSENT_VERSION,
      rightsConfirmedAt: new Date().toISOString(),
      updatesConsentAt: updatesConsent ? new Date().toISOString() : null
    });
    uploadedKey = null;

    if (updatesConsent) {
      try {
        await db.insert(waitlist).values({ email, game: "rocket-league", source, campaign, privacyVersion: CONSENT_VERSION }).onConflictDoNothing();
      } catch (error) {
        // Replay custody is the primary request. An optional marketing-list write
        // must never turn a secured replay into a false submission failure.
        console.warn("rl beta updates opt-in failed", { code: operationalErrorCode(error) });
      }
    }

    return Response.json({
      received: true,
      publicId,
      state: {
        file: "secured",
        parser: "pending",
        playerAttribution: "pending",
        modeVerification: "pending",
        coaching: "gated"
      }
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedKey) {
      try {
        const { env } = await import("cloudflare:workers");
        await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.delete(uploadedKey);
      } catch { /* best-effort cleanup */ }
    }
    console.error("rl beta submission failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "We couldn’t secure that replay. Try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
