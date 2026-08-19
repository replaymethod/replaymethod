import { getDatabase } from "../db";
import { entitlementWindow, paidEntitlementWindow } from "./entitlement-policy.mjs";
import { authenticatedPlayer } from "./player-session";

type SubscriptionRow = {
  planKey: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceUntil: string | null;
  cancelAtPeriodEnd: number;
};

export class EntitlementError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function latestSubscription(db: D1Database, playerId: number) {
  return db.prepare(`SELECT plan_key AS planKey, status, current_period_start AS currentPeriodStart,
      current_period_end AS currentPeriodEnd, grace_until AS graceUntil,
      cancel_at_period_end AS cancelAtPeriodEnd
    FROM billing_subscriptions WHERE player_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .bind(playerId).first<SubscriptionRow>();
}

export async function reserveAnalysisAccess(request: Request, playerId: number, analysisPublicId: string) {
  const db = await getDatabase();
  const signedIn = await authenticatedPlayer(request, db);
  const subscription = signedIn?.id === playerId ? await latestSubscription(db, playerId) : null;
  const window = entitlementWindow(subscription, new Date());

  const existing = await db.prepare(`SELECT access_kind AS accessKind, plan_key AS planKey, window_start AS windowStart,
      window_end AS windowEnd, slot FROM analysis_usage WHERE analysis_public_id = ? AND status IN ('reserved', 'consumed')`)
    .bind(analysisPublicId).first<Record<string, unknown>>();
  if (existing) return existing;

  for (let slot = 1; slot <= window.limit; slot += 1) {
    const result = await db.prepare(`INSERT OR IGNORE INTO analysis_usage (
        public_id, analysis_public_id, player_id, access_kind, plan_key, window_start, window_end, slot, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved')`)
      .bind(crypto.randomUUID().replaceAll("-", ""), analysisPublicId, playerId, window.accessKind,
        window.planKey, window.windowStart, window.windowEnd, slot).run();
    if (result.meta.changes) return { ...window, slot };
  }

  if (window.accessKind === "free") {
    throw new EntitlementError("Your first completed diagnosis has already been used. Verify your report history, then choose a paid plan to continue.", 402);
  }
  throw new EntitlementError("You have used all four analyses in this 30-day window. Your next allowance opens automatically when the window resets.", 429);
}

export async function attachAnalysisUsage(analysisPublicId: string, analysisRequestId: number) {
  const db = await getDatabase();
  await db.prepare(`UPDATE analysis_usage SET analysis_request_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE analysis_public_id = ? AND status = 'reserved'`).bind(analysisRequestId, analysisPublicId).run();
}

export async function releaseAnalysisUsage(analysisPublicId: string) {
  const db = await getDatabase();
  await db.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP WHERE analysis_public_id = ? AND status = 'reserved'`)
    .bind(analysisPublicId).run();
}

export async function billingSnapshot(playerId: number) {
  const db = await getDatabase();
  const subscription = await latestSubscription(db, playerId);
  const window = paidEntitlementWindow(subscription, new Date());
  const effective = window || entitlementWindow(null);
  const count = await db.prepare(`SELECT count(*) AS count FROM analysis_usage
    WHERE player_id = ? AND access_kind = ? AND window_start = ? AND status IN ('reserved', 'consumed')`)
    .bind(playerId, effective.accessKind, effective.windowStart).first<{ count: number }>();
  return {
    planKey: window?.planKey || null,
    status: subscription?.status || "free",
    hasBillingAccount: Boolean(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    paymentGrace: Boolean(window?.paymentGrace),
    used: Number(count?.count || 0),
    limit: effective.limit,
    windowEnd: effective.windowEnd,
  };
}
